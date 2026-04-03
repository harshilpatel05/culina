'use client'

import { ManagerDashboard } from "@/components/ui/manager-dashboard";
import { ProtectedRoute } from "@/components/protected-route";

export default function ManagerDashPage() {
	return (
		<ProtectedRoute requiredRole="manager">
			<ManagerDashboard />
		</ProtectedRoute>
	);

}
