import { redirect } from 'next/navigation';
import UserManagement from '@/components/admin/user-management';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, LogOut } from 'lucide-react';
import Image from 'next/image';

export default async function AdminPage() {
  const handleLogout = async () => {
    'use server';
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (response.ok) {
      redirect('/');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Image
                src="/EENlogo.jpeg"
                alt="EEN Multitech Logo"
                width={32}
                height={32}
                className="object-contain"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                EEN Multitech
              </h1>
            </div>
            <form action={handleLogout}>
              <Button variant="outline">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Auto-Delete</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">15 days</div>
              <p className="text-xs text-muted-foreground">Current setting</p>
            </CardContent>
          </Card>
        </div>

        <UserManagement />
      </main>
    </div>
  );
}
