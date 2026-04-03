'use client'

import { WaiterDashboard } from "@/components/ui/waiter-dashboard";
import { ProtectedRoute } from "@/components/protected-route";

export default function WaiterDashPage() {
	return (
		<ProtectedRoute requiredRole="staff">
			<WaiterDashboard />
		</ProtectedRoute>
	);
}
