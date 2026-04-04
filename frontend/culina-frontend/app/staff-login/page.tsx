'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, ScanLine, ShieldCheck, UtensilsCrossed } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/hooks/use-auth'

export default function StaffLoginPage() {
	const router = useRouter()
	const { user, loading: authLoading } = useAuth()
	const [isManagerLoading, setIsManagerLoading] = useState(false)
	const [managerError, setManagerError] = useState<string | null>(null)

	// Redirect if already authenticated
	useEffect(() => {
		if (!authLoading && user) {
			if (user.role === 'manager' || user.role === 'admin') {
				router.push('/manager-dash')
			} else {
				router.push('/waiter-dash')
			}
		}
	}, [user, authLoading, router])

	const handleManagerGoogleSignIn = async () => {
		setManagerError(null)
		setIsManagerLoading(true)

		const supabase = createClient()
		const redirectTo = `${window.location.origin}/auth/callback?next=/manager-dash`

		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo,
			},
		})

		if (error) {
			setManagerError(error.message)
			setIsManagerLoading(false)
		}
	}

	return (
		<main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8 text-foreground sm:px-6 lg:px-8">
			<div
				className="pointer-events-none absolute inset-0 opacity-70"
				aria-hidden="true"
			>
				<div className="absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
				<div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
			</div>

			<section className="relative mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
				<Card className="border-border/70 bg-card/90 backdrop-blur-sm">
					<CardHeader className="space-y-4 pb-0">
						<Badge variant="secondary" className="w-fit">
							Culina Staff Portal
						</Badge>
						<CardTitle className="text-3xl tracking-tight sm:text-4xl">
							Welcome back, team.
						</CardTitle>
						<CardDescription className="max-w-xl text-sm sm:text-base">
							Securely sign in to manage service flow, floor activity, and live
							table updates from one place.
						</CardDescription>
					</CardHeader>
					<CardContent className="mt-4 space-y-4">
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="rounded-lg border border-border/70 bg-background/70 p-3">
								<div className="mb-2 inline-flex rounded-md border border-border p-2">
									<UtensilsCrossed className="size-4 text-accent" />
								</div>
								<p className="text-sm font-medium">Shift-Ready</p>
								<p className="text-xs text-muted-foreground">
									Open tables and ticket flow visible at a glance.
								</p>
							</div>
							<div className="rounded-lg border border-border/70 bg-background/70 p-3">
								<div className="mb-2 inline-flex rounded-md border border-border p-2">
									<ScanLine className="size-4 text-accent" />
								</div>
								<p className="text-sm font-medium">Fast Check-In</p>
								<p className="text-xs text-muted-foreground">
									Access your station in seconds.
								</p>
							</div>
							<div className="rounded-lg border border-border/70 bg-background/70 p-3">
								<div className="mb-2 inline-flex rounded-md border border-border p-2">
									<ShieldCheck className="size-4 text-accent" />
								</div>
								<p className="text-sm font-medium">Protected Access</p>
								<p className="text-xs text-muted-foreground">
									Role-based sign in for managers and floor staff.
								</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/80 bg-card/95 shadow-lg backdrop-blur-sm">
					<CardHeader>
						<CardTitle className="text-2xl">Staff Login</CardTitle>
						<CardDescription>
							Use your role credentials to continue.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Tabs defaultValue="login" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="login">Login</TabsTrigger>
								<TabsTrigger value="signup">Manager Sign Up</TabsTrigger>
							</TabsList>

							<TabsContent value="login" className="mt-4 space-y-4">
								<LoginForm
									title="POS Access"
									subtitle="For floor operations and live orders"
								/>
							</TabsContent>

							<TabsContent value="signup" className="mt-4 space-y-4">
								<SignUpForm />
							</TabsContent>
						</Tabs>

						<Separator />

						<p className="text-center text-xs text-muted-foreground">
							Need access? Contact your system administrator.
						</p>
					</CardContent>
				</Card>
			</section>
		</main>
	)
}

type LoginFormProps = {
	title: string
	subtitle: string
}

function LoginForm({ title, subtitle }: LoginFormProps) {
	const router = useRouter()
	const [staffId, setStaffId] = useState('')
	const [password, setPassword] = useState('')
	const [rememberMe, setRememberMe] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const role = title.toLowerCase().startsWith('waiter') ? 'staff' : 'manager'

	useEffect(() => {
		// Load remembered staff ID if available
		const savedStaffId = localStorage.getItem('remembered_staff_id')
		if (savedStaffId) {
			setStaffId(savedStaffId)
			setRememberMe(true)
		}
	}, [])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)
		setIsLoading(true)

		try {
			// Call the staff authentication API
			const response = await fetch('/api/staff-auth', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				credentials: 'include', // Important: to include cookies
				body: JSON.stringify({
					staff_id: staffId,
					password: password
				})
			})

			const data = await response.json()

			if (!response.ok) {
				setError(data.error || 'Login failed. Please try again.')
				setIsLoading(false)
				return
			}

			// Store or clear remembered staff ID
			if (rememberMe) {
				localStorage.setItem('remembered_staff_id', staffId)
			} else {
				localStorage.removeItem('remembered_staff_id')
			}

			// Authentication successful
			// JWT is automatically stored in httpOnly cookie by the API
			console.log('Login successful:', data.message)

			// Redirect based on role
			const userRole = data.user.role
			if (userRole === 'manager' || userRole === 'admin') {
				router.push('/manager-dash')
			} else {
				router.push('/waiter-dash')
			}
		} catch (err) {
			console.error('Login error:', err)
			setError(err instanceof Error ? err.message : 'An error occurred during login')
			setIsLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="rounded-lg border border-border/70 bg-background/70 p-3">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">{subtitle}</p>
			</div>

			<div className="space-y-2">
				<Label htmlFor={`${title}-staff-id`}>Staff ID</Label>
				<Input
					id={`${title}-staff-id`}
					type="text"
					placeholder="CUL-1024"
					value={staffId}
					onChange={(e) => setStaffId(e.target.value)}
					disabled={isLoading}
					required
				/>
			</div>

			<div className="space-y-2">
				<Label htmlFor={`${title}-pin`}>Password</Label>
				<div className="relative">
					<Input
						id={`${title}-pin`}
						type="password"
						placeholder="Enter password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						disabled={isLoading}
						required
					/>
					<KeyRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
				</div>
			</div>

			{error && (
				<div className="rounded-md bg-destructive/10 p-3">
					<p className="text-xs text-destructive">{error}</p>
				</div>
			)}

			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<Checkbox
						id={`${title}-remember`}
						checked={rememberMe}
						onCheckedChange={(checked) => setRememberMe(checked as boolean)}
						disabled={isLoading}
					/>
					<Label htmlFor={`${title}-remember`} className="text-xs text-muted-foreground">
						Keep me signed in
					</Label>
				</div>
				<Link href="#" className="text-xs text-accent hover:underline">
					Reset access
				</Link>
			</div>

			<Button
				type="submit"
				className="w-full"
				disabled={isLoading || !staffId || !password}
			>
				{isLoading ? 'Signing in...' : 'Sign In'}
			</Button>
		</form>
	)
}

type SignUpFormProps = {}

function SignUpForm({}: SignUpFormProps) {
	const router = useRouter()
	const [formData, setFormData] = useState({
		restaurantName: '',
		restaurantLocation: '',
		managerName: '',
		staffId: '',
		password: '',
		confirmPassword: '',
	})
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

	// Client-side validation
	const validateForm = (): boolean => {
		const errors: Record<string, string> = {}

		if (!formData.restaurantName.trim()) {
			errors.restaurantName = 'Restaurant name is required'
		}
		if (!formData.restaurantLocation.trim()) {
			errors.restaurantLocation = 'Location is required'
		}
		if (!formData.managerName.trim()) {
			errors.managerName = 'Name is required'
		}
		if (!formData.staffId.trim()) {
			errors.staffId = 'Staff ID is required'
		} else if (!/^[A-Z0-9]+-?[A-Z0-9]*$/.test(formData.staffId)) {
			errors.staffId = 'Invalid format. Use format like "CUL-1024"'
		}
		if (!formData.password) {
			errors.password = 'Password is required'
		} else if (formData.password.length < 8) {
			errors.password = 'Password must be at least 8 characters'
		}
		if (!formData.confirmPassword) {
			errors.confirmPassword = 'Please confirm your password'
		} else if (formData.password !== formData.confirmPassword) {
			errors.confirmPassword = 'Passwords do not match'
		}

		setFieldErrors(errors)
		return Object.keys(errors).length === 0
	}

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}))
		// Clear field error when user starts typing
		if (fieldErrors[name]) {
			setFieldErrors((prev) => ({
				...prev,
				[name]: '',
			}))
		}
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		setError(null)

		if (!validateForm()) {
			return
		}

		setIsLoading(true)

		try {
			const response = await fetch('/api/staff-auth/signup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					restaurant_name: formData.restaurantName,
					restaurant_location: formData.restaurantLocation,
					manager_name: formData.managerName,
					staff_id: formData.staffId,
					password: formData.password,
				}),
			})

			const data = await response.json()

			if (!response.ok) {
				if (response.status === 409) {
					setFieldErrors((prev) => ({
						...prev,
						staffId: data.error || 'Staff ID already exists',
					}))
				} else {
					setError(data.error || 'Sign up failed. Please try again.')
				}
				setIsLoading(false)
				return
			}

			// Sign up successful
			console.log('Sign up successful:', data.message)

			// Auto-login redirect
			router.push('/manager-dash')
		} catch (err) {
			console.error('Sign up error:', err)
			setError(err instanceof Error ? err.message : 'An error occurred during sign up')
			setIsLoading(false)
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="rounded-lg border border-border/70 bg-background/70 p-3">
				<p className="text-sm font-medium">Create Manager Account</p>
				<p className="text-xs text-muted-foreground">
					Set up your restaurant and manager profile
				</p>
			</div>

			{/* Restaurant Details Section */}
			<div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
				<p className="text-xs font-semibold text-muted-foreground">RESTAURANT DETAILS</p>

				<div className="space-y-2">
					<Label htmlFor="restaurantName">Restaurant Name</Label>
					<Input
						id="restaurantName"
						name="restaurantName"
						type="text"
						placeholder="e.g., The Golden Fork"
						value={formData.restaurantName}
						onChange={handleChange}
						disabled={isLoading}
						className={fieldErrors.restaurantName ? 'border-destructive' : ''}
					/>
					{fieldErrors.restaurantName && (
						<p className="text-xs text-destructive">{fieldErrors.restaurantName}</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="restaurantLocation">Location</Label>
					<Input
						id="restaurantLocation"
						name="restaurantLocation"
						type="text"
						placeholder="e.g., 123 Main St, Downtown"
						value={formData.restaurantLocation}
						onChange={handleChange}
						disabled={isLoading}
						className={fieldErrors.restaurantLocation ? 'border-destructive' : ''}
					/>
					{fieldErrors.restaurantLocation && (
						<p className="text-xs text-destructive">{fieldErrors.restaurantLocation}</p>
					)}
				</div>
			</div>

			{/* Manager Details Section */}
			<div className="space-y-3 rounded-lg border border-border/50 bg-background/30 p-3">
				<p className="text-xs font-semibold text-muted-foreground">MANAGER DETAILS</p>

				<div className="space-y-2">
					<Label htmlFor="managerName">Full Name</Label>
					<Input
						id="managerName"
						name="managerName"
						type="text"
						placeholder="e.g., John Smith"
						value={formData.managerName}
						onChange={handleChange}
						disabled={isLoading}
						className={fieldErrors.managerName ? 'border-destructive' : ''}
					/>
					{fieldErrors.managerName && (
						<p className="text-xs text-destructive">{fieldErrors.managerName}</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="staffId">Staff ID</Label>
					<Input
						id="staffId"
						name="staffId"
						type="text"
						placeholder="CUL-1024"
						value={formData.staffId}
						onChange={handleChange}
						disabled={isLoading}
						className={fieldErrors.staffId ? 'border-destructive' : ''}
					/>
					{fieldErrors.staffId && (
						<p className="text-xs text-destructive">{fieldErrors.staffId}</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="password">Password</Label>
					<div className="relative">
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="Minimum 8 characters"
							value={formData.password}
							onChange={handleChange}
							disabled={isLoading}
							className={fieldErrors.password ? 'border-destructive' : ''}
						/>
						<KeyRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					</div>
					{fieldErrors.password && (
						<p className="text-xs text-destructive">{fieldErrors.password}</p>
					)}
				</div>

				<div className="space-y-2">
					<Label htmlFor="confirmPassword">Confirm Password</Label>
					<div className="relative">
						<Input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							placeholder="Re-enter your password"
							value={formData.confirmPassword}
							onChange={handleChange}
							disabled={isLoading}
							className={fieldErrors.confirmPassword ? 'border-destructive' : ''}
						/>
						<KeyRound className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					</div>
					{fieldErrors.confirmPassword && (
						<p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
					)}
				</div>
			</div>

			{error && (
				<div className="rounded-md bg-destructive/10 p-3">
					<p className="text-xs text-destructive">{error}</p>
				</div>
			)}

			<Button
				type="submit"
				className="w-full"
				disabled={
					isLoading ||
					!formData.restaurantName ||
					!formData.restaurantLocation ||
					!formData.managerName ||

					!formData.staffId ||
					!formData.password ||
					!formData.confirmPassword
				}
			>
				{isLoading ? 'Creating Account...' : 'Create Manager Account'}
			</Button>
		</form>
	)
}
