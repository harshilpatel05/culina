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
		const redirectTo = 'https://culina-sable.vercel.app/manager-dash'

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
						<Tabs defaultValue="waiter" className="w-full">
							<TabsList className="grid w-full grid-cols-2">
								<TabsTrigger value="waiter">Waiter</TabsTrigger>
								<TabsTrigger value="manager">Manager</TabsTrigger>
							</TabsList>

							<TabsContent value="waiter" className="mt-4 space-y-4">
								<LoginForm
									title="Waiter Access"
									subtitle="For floor operations and live orders"
								/>
							</TabsContent>

							<TabsContent value="manager" className="mt-4 space-y-4">
								<div className="space-y-4">
									<div className="rounded-lg border border-border/70 bg-background/70 p-3">
										<p className="text-sm font-medium">Manager Access</p>
										<p className="text-xs text-muted-foreground">
											Sign in with your Google workspace account.
										</p>
									</div>

									<Button
										type="button"
										variant="outline"
										className="w-full"
										onClick={handleManagerGoogleSignIn}
										disabled={isManagerLoading}
									>
										<span className="inline-flex size-4 items-center justify-center rounded-full border border-border text-[10px] font-semibold">
											G
										</span>
										{isManagerLoading ? 'Redirecting to Google...' : 'Continue with Google'}
									</Button>

									{managerError ? (
										<p className="text-xs text-destructive" role="alert">
											{managerError}
										</p>
									) : null}
								</div>
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
