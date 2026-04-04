import pandas as pd
import numpy as np
import lightgbm as lgb
from math import sqrt, ceil

# =========================
# CONFIG
# =========================
LEAD_TIME_DAYS = 2
REVIEW_PERIOD_DAYS = 3
SERVICE_LEVEL_Z = 1.65  # 95%
PACK_SIZE_DEFAULT = 1.0

# =========================
# 1. LOAD DATA
# =========================
def load_data():
    snapshots = pd.read_csv("inventory_snapshots.csv")
    restocks = pd.read_csv("restocks.csv")
    return snapshots, restocks


# =========================
# 2. BUILD DAILY INVENTORY
# =========================
def build_daily_inventory(snapshots, restocks):
    snapshots["snapshot_captured_at"] = pd.to_datetime(snapshots["snapshot_captured_at"])
    snapshots["date"] = snapshots["snapshot_captured_at"].dt.date

    # Opening stock (first)
    opening = (
        snapshots[snapshots["snapshot_type"] == "opening"]
        .sort_values("snapshot_captured_at")
        .groupby(["ingredient_id", "date"])
        .first()
    )

    # Closing stock (last)
    closing = (
        snapshots[snapshots["snapshot_type"] == "closing"]
        .sort_values("snapshot_captured_at")
        .groupby(["ingredient_id", "date"])
        .last()
    )

    df = opening[["current_stock"]].rename(columns={"current_stock": "opening_stock"})
    df = df.join(closing[["current_stock"]].rename(columns={"current_stock": "closing_stock"}))

    # Restocks
    restocks["restock_time"] = pd.to_datetime(restocks["restock_time"])
    restocks["date"] = restocks["restock_time"].dt.date

    restock_daily = restocks.groupby(["ingredient_id", "date"])["restocked_qty"].sum()
    df = df.join(restock_daily)
    df["restocked_qty"] = pd.to_numeric(df["restocked_qty"], errors="coerce").fillna(0.0)

    # Wastage
    wastage = snapshots.groupby(["ingredient_id", "date"])["wastage_qty"].sum()
    df = df.join(wastage)
    df["wastage_qty"] = pd.to_numeric(df["wastage_qty"], errors="coerce").fillna(0.0)

    # Metadata
    meta = (
        snapshots.sort_values("snapshot_captured_at")
        .groupby(["ingredient_id", "date"])
        .last()[["ingredient_name", "unit", "reorder_level"]]
    )

    df = df.join(meta)

    # Ensure numeric fields are typed correctly before downstream math.
    for column in ["opening_stock", "closing_stock", "reorder_level"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")

    # Fill missing opening from previous closing
    df = df.sort_index()
    df["closing_prev"] = df.groupby(level=0)["closing_stock"].shift(1)
    df["opening_stock"] = df["opening_stock"].fillna(df["closing_prev"])

    df = df.dropna(subset=["opening_stock", "closing_stock"])

    # Compute consumption
    df["consumption"] = (
        df["opening_stock"]
        + df["restocked_qty"]
        - df["closing_stock"]
        - df["wastage_qty"]
    ).clip(lower=0)

    return df.reset_index()


# =========================
# 3. FEATURE ENGINEERING
# =========================
def build_features(df):
    df = df.sort_values(["ingredient_id", "date"])
    df["date"] = pd.to_datetime(df["date"])
    g = df.groupby("ingredient_id")

    # Lags
    for lag in [1, 2, 3, 7, 14, 28]:
        df[f"lag_{lag}"] = g["consumption"].shift(lag)

    # Rolling
    for w in [7, 14, 28]:
        df[f"mean_{w}"] = g["consumption"].shift(1).rolling(w).mean()
        df[f"std_{w}"] = g["consumption"].shift(1).rolling(w).std()

    # Calendar
    df["dow"] = df["date"].dt.dayofweek
    df["month"] = df["date"].dt.month
    df["is_weekend"] = (df["dow"] >= 5).astype(int)

    # Encode ingredient
    df["ingredient_code"] = df["ingredient_id"].astype("category").cat.codes

    return df


# =========================
# 4. TRAIN MODEL
# =========================
def train_model(df, feature_cols):
    train_df = df.dropna(subset=["consumption"]).copy()
    usable_feature_cols = [col for col in feature_cols if col in train_df.columns]

    if len(usable_feature_cols) == 0:
        return None, usable_feature_cols

    train_df = train_df.dropna(subset=usable_feature_cols)
    if train_df.empty:
        return None, usable_feature_cols

    X = train_df[usable_feature_cols]
    y = train_df["consumption"]

    model = lgb.LGBMRegressor(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=8,
        num_leaves=31,
        subsample=0.8,
        colsample_bytree=0.8
    )

    model.fit(X, y)
    return model, usable_feature_cols


# =========================
# 5. PREDICT
# =========================
def predict_latest(df, model, feature_cols):
    latest = (
        df.sort_values("date")
        .groupby("ingredient_id")
        .tail(1)
        .copy()
    )

    if latest.empty:
        return latest

    # Fallback prediction when model or complete features are unavailable.
    fallback_cols = [col for col in ["mean_7", "mean_14", "lag_1", "consumption"] if col in latest.columns]
    if fallback_cols:
        latest["predicted_consumption"] = latest[fallback_cols].apply(
            lambda row: np.nanmean(row.values.astype(float)), axis=1
        )
        latest["predicted_consumption"] = latest["predicted_consumption"].replace([np.inf, -np.inf], np.nan).fillna(0)
    else:
        latest["predicted_consumption"] = 0.0

    if model is None or len(feature_cols) == 0:
        return latest

    available_feature_cols = [col for col in feature_cols if col in latest.columns]
    if len(available_feature_cols) == 0:
        return latest

    model_ready_mask = latest[available_feature_cols].notna().all(axis=1)
    if model_ready_mask.any():
        latest.loc[model_ready_mask, "predicted_consumption"] = model.predict(
            latest.loc[model_ready_mask, available_feature_cols]
        )

    latest["predicted_consumption"] = latest["predicted_consumption"].clip(lower=0)

    return latest


# =========================
# 6. INVENTORY DECISION ENGINE
# =========================
def compute_restock(latest):
    df = latest.copy()

    # Demand uncertainty
    df["std"] = df["std_14"].fillna(df["std_7"]).fillna(0)

    # Lead time demand
    df["lead_time_demand"] = df["predicted_consumption"] * LEAD_TIME_DAYS

    # Safety stock
    df["safety_stock"] = SERVICE_LEVEL_Z * df["std"] * np.sqrt(LEAD_TIME_DAYS)

    # Reorder point
    df["reorder_point"] = df["lead_time_demand"] + df["safety_stock"]

    # Target stock
    df["target_stock"] = (
        df["predicted_consumption"] * (LEAD_TIME_DAYS + REVIEW_PERIOD_DAYS)
        + df["safety_stock"]
    )

    # Decision
    df["need_restock"] = (df["closing_stock"] <= df["reorder_point"]).astype(int)

    df["order_qty"] = np.where(
        df["need_restock"] == 1,
        np.maximum(0, df["target_stock"] - df["closing_stock"]),
        0
    )

    # Pack rounding
    df["pack_size"] = PACK_SIZE_DEFAULT
    df["order_qty"] = df["order_qty"].apply(
        lambda x: ceil(x / PACK_SIZE_DEFAULT) * PACK_SIZE_DEFAULT
    )

    return df


# =========================
# 7. MAIN PIPELINE
# =========================
def run_pipeline():
    snapshots, restocks = load_data()

    df = build_daily_inventory(snapshots, restocks)
    df = build_features(df)

    feature_cols = [
        "lag_1", "lag_2", "lag_3", "lag_7",
        "mean_7", "mean_14", "std_7", "std_14",
        "dow", "month", "is_weekend",
        "ingredient_code"
    ]

    model, usable_feature_cols = train_model(df, feature_cols)

    latest = predict_latest(df, model, usable_feature_cols)

    if latest.empty:
        output_cols = [
            "ingredient_name",
            "closing_stock",
            "predicted_consumption",
            "reorder_point",
            "order_qty",
            "need_restock"
        ]
        pd.DataFrame(columns=output_cols).to_csv("restock_recommendations.csv", index=False)
        print("\n=== RESTOCK RECOMMENDATIONS ===")
        print("No data available to produce recommendations.")
        return

    results = compute_restock(latest)

    output_cols = [
        "ingredient_name",
        "closing_stock",
        "predicted_consumption",
        "reorder_point",
        "order_qty",
        "need_restock"
    ]

    final = results[output_cols].sort_values("need_restock", ascending=False)

    final.to_csv("restock_recommendations.csv", index=False)

    print("\n=== RESTOCK RECOMMENDATIONS ===")
    print(final.head(20))


# =========================
# RUN
# =========================
if __name__ == "__main__":
    run_pipeline()