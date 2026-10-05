import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { User, Bell, Shield, Database, Download, Loader2, Archive, Cpu } from "lucide-react"
import { redirect } from "next/navigation"
import {
  updateProfile,
  updatePassword,
  updatePreferences,
  updateNotifications,
  signOutAllDevices,
} from "@/lib/actions/settings"
import { AvatarUpload } from "@/components/avatar-upload"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  const [propertiesCount, tenantsCount, paymentsCount] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("tenants").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("rent_payments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ])

  return (
    <div className="space-y-6 pt-2 md:pt-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-sm md:text-base text-muted-foreground">Manage your account, workspace name, preferences and security</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-7 h-auto">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="preferences" className="flex items-center gap-2">
            <span className="text-sm">Prefs</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Security</span>
          </TabsTrigger>
          <TabsTrigger value="data" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Data</span>
          </TabsTrigger>
          <TabsTrigger value="backup" asChild className="flex items-center gap-2">
            <a href="/dashboard/settings/backup" className="flex items-center gap-2">
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Backup</span>
            </a>
          </TabsTrigger>
          <TabsTrigger value="system" asChild className="flex items-center gap-2">
            <a href="/dashboard/settings/system" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              <span className="hidden sm:inline">System</span>
            </a>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
              <CardDescription>Square images work best. Max 5 MB.</CardDescription>
            </CardHeader>
            <CardContent>
              <AvatarUpload
                currentUrl={profile?.avatar_url || null}
                fallbackName={profile?.full_name || user.email || "User"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information and contact details</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    defaultValue={profile?.full_name || ""}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user.email || ""}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-sm text-muted-foreground">Email cannot be changed from here</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      name="phone"
                      defaultValue={profile?.phone || ""}
                      placeholder="e.g., +254 XXX XXX XXX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Workspace name</Label>
                    <Input
                      id="company_name"
                      name="company_name"
                      defaultValue={profile?.company_name || ""}
                      placeholder="e.g. Wangari Properties"
                    />
                    <p className="text-xs text-muted-foreground">This name appears in your dashboard sidebar and workspace.</p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      defaultValue={profile?.city || ""}
                      placeholder="Enter your city"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="county">County</Label>
                    <Input
                      id="county"
                      name="county"
                      defaultValue={profile?.county || ""}
                      placeholder="Enter your county"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={profile?.address || ""}
                    placeholder="Enter your address"
                  />
                </div>

                <Separator />

                <div className="flex gap-4">
                  <Button type="submit" className="font-semibold">
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
              <CardDescription>Customize system settings to match your needs</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePreferences} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="currency">Default Currency</Label>
                    <Select name="currency" defaultValue={profile?.currency || "KES"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KES">Kenyan Shilling (KES)</SelectItem>
                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_format">Date Format</Label>
                    <Select name="date_format" defaultValue={profile?.date_format || "DD/MM/YYYY"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select name="timezone" defaultValue={profile?.timezone || "Africa/Nairobi"}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Africa/Nairobi">East Africa Time (EAT)</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                        <SelectItem value="America/New_York">Eastern Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-4">
                  <Button type="submit" className="font-semibold">
                    Save Preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Manage your notification preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateNotifications} className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium">Rent Payment Alerts</h4>
                      <p className="text-sm text-muted-foreground">Get notified when rent payments are due</p>
                    </div>
                    <Switch name="rent_alerts" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium">Maintenance Requests</h4>
                      <p className="text-sm text-muted-foreground">New maintenance requests from tenants</p>
                    </div>
                    <Switch name="maintenance_alerts" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium">Lease Expiry Warnings</h4>
                      <p className="text-sm text-muted-foreground">30 days before lease expires</p>
                    </div>
                    <Switch name="lease_alerts" defaultChecked />
                  </div>

                  <div className="flex items-center justify-between p-4 border rounded-lg gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-medium">Financial Reports</h4>
                      <p className="text-sm text-muted-foreground">Monthly financial summaries</p>
                    </div>
                    <Switch name="financial_reports" />
                  </div>
                </div>

                <Separator />

                <div className="flex gap-4">
                  <Button type="submit" className="font-semibold">
                    Update Notifications
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your account security and privacy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <form action={updatePassword} className="space-y-4">
                  <h4 className="font-medium">Change Password</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new_password">New Password</Label>
                      <Input
                        id="new_password"
                        name="new_password"
                        type="password"
                        minLength={6}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <Button type="submit" className="font-semibold">
                      Update Password
                    </Button>
                  </div>
                </form>

                <Separator />

                <div>
                  <h4 className="font-medium mb-4">Account Security Status</h4>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Your account is protected with strong encryption
                    </p>
                    <Badge variant="secondary">Protected</Badge>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-4">Session Management</h4>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-3">
                    <p className="text-sm text-muted-foreground">Sign out from all devices for security</p>
                    <form action={signOutAllDevices}>
                      <Button type="submit" variant="destructive" className="font-semibold w-full sm:w-auto">
                        Sign Out All Devices
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Export and manage your property data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold">Properties</h3>
                      <p className="text-2xl font-bold text-primary">{propertiesCount.count || 0}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold">Tenants</h3>
                      <p className="text-2xl font-bold text-secondary">{tenantsCount.count || 0}</p>
                      <p className="text-sm text-muted-foreground">Active</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-2">
                      <h3 className="font-semibold">Payments</h3>
                      <p className="text-2xl font-bold text-accent">{paymentsCount.count || 0}</p>
                      <p className="text-sm text-muted-foreground">Records</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Export Data</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download a snapshot of all your properties, tenants, payments, expenses, maintenance, notes, and documents.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" asChild>
                      <a href="/api/export?format=json" download>
                        <Download className="h-4 w-4 mr-2" />
                        Download JSON
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="/api/export?format=csv" download>
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="pt-6 mt-8 border-t border-border text-center text-[11px] text-muted-foreground space-y-1">
        <p>
  <span className="font-semibold text-foreground">I-Manage</span>
          <span className="mx-1.5 opacity-60">·</span>
          © {new Date().getFullYear()}
        </p>
        <p>
          Crafted with care by{" "}
          <a
            href="https://www.linkedin.com/in/brian-kiarie-00b3a3391"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            Brian Kiarie
          </a>
          {" · "}
          <a
            href="https://github.com/Knighty7-ciper"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
