import numpy as np
import pandas as pd

INPUT_CSV = "employee_logs.csv"
OUTPUT_CSV = "employee_performance_results.csv"


def assign_category(score: float) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Good"
    if score >= 50:
        return "Average"
    return "Needs Improvement"


def run_pipeline() -> None:
    try:
        df = pd.read_csv(INPUT_CSV)
    except FileNotFoundError:
        empty = pd.DataFrame(
            columns=[
                "employee_id",
                "score",
                "category",
                "avg_orders_per_hour",
                "total_orders",
                "attendance_days",
            ]
        )
        empty.to_csv(OUTPUT_CSV, index=False)
        return

    required_columns = {
        "employee_id",
        "date",
        "start_time",
        "end_time",
        "duration",
        "orders_completed",
    }

    missing_columns = required_columns.difference(df.columns)
    if missing_columns:
        raise ValueError(f"Missing required columns: {sorted(missing_columns)}")

    if df.empty:
        empty = pd.DataFrame(
            columns=[
                "employee_id",
                "score",
                "category",
                "avg_orders_per_hour",
                "total_orders",
                "attendance_days",
            ]
        )
        empty.to_csv(OUTPUT_CSV, index=False)
        return

    df = df.copy()
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["duration"] = pd.to_numeric(df["duration"], errors="coerce").fillna(0)
    df["orders_completed"] = pd.to_numeric(df["orders_completed"], errors="coerce").fillna(0)

    # Feature 1: row-level orders per hour.
    df["orders_per_hour"] = np.where(
        df["duration"] > 0,
        df["orders_completed"] / df["duration"],
        0.0,
    )

    # Feature 2: daily totals per employee.
    daily = (
        df.groupby(["employee_id", "date"], as_index=False)
        .agg(
            daily_orders_completed=("orders_completed", "sum"),
            daily_duration=("duration", "sum"),
        )
    )

    daily["orders_per_hour"] = np.where(
        daily["daily_duration"] > 0,
        daily["daily_orders_completed"] / daily["daily_duration"],
        0.0,
    )

    employee = (
        daily.groupby("employee_id", as_index=False)
        .agg(
            avg_orders_per_hour=("orders_per_hour", "mean"),
            total_orders=("daily_orders_completed", "sum"),
            attendance_days=("date", "nunique"),
            consistency=("orders_per_hour", "std"),
        )
    )

    employee["consistency"] = employee["consistency"].fillna(0.0)

    # Convert raw metrics into bounded business scores (0-100) so one feature cannot dominate.
    target_orders_per_hour = 6.0
    target_total_orders = 220.0
    target_attendance_days = 26.0

    employee["throughput_score"] = np.clip(
        (employee["avg_orders_per_hour"] / target_orders_per_hour) * 100.0,
        0.0,
        100.0,
    )
    employee["volume_score"] = np.clip(
        (employee["total_orders"] / target_total_orders) * 100.0,
        0.0,
        100.0,
    )
    employee["attendance_score"] = np.clip(
        (employee["attendance_days"] / target_attendance_days) * 100.0,
        0.0,
        100.0,
    )
    employee["consistency_score"] = np.clip(
        (1.0 / (1.0 + employee["consistency"])) * 100.0,
        0.0,
        100.0,
    )

    employee["score"] = (
        0.45 * employee["throughput_score"]
        + 0.30 * employee["volume_score"]
        + 0.15 * employee["attendance_score"]
        + 0.10 * employee["consistency_score"]
    )

    # Hard guardrail: no completed orders should not appear as high performance.
    employee["score"] = np.where(
        employee["total_orders"] <= 0,
        np.minimum(employee["score"], 35.0),
        employee["score"],
    )

    employee["score"] = employee["score"].clip(lower=0, upper=100).round(2)
    employee["avg_orders_per_hour"] = employee["avg_orders_per_hour"].round(4)
    employee["total_orders"] = employee["total_orders"].round(0).astype(int)
    employee["attendance_days"] = employee["attendance_days"].astype(int)
    employee["category"] = employee["score"].apply(assign_category)

    output = employee[
        [
            "employee_id",
            "score",
            "category",
            "avg_orders_per_hour",
            "total_orders",
            "attendance_days",
        ]
    ].sort_values("score", ascending=False)

    output.to_csv(OUTPUT_CSV, index=False)


if __name__ == "__main__":
    run_pipeline()
