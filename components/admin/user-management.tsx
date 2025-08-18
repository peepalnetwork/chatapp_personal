'use client';

import type React from 'react';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit, Plus, Eye, EyeOff } from 'lucide-react';
import type { User } from '@/lib/models/server';
import { toast } from 'sonner';
import { io, type Socket } from 'socket.io-client';

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [presence, setPresence] = useState<Record<string, boolean>>({});
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showPasswords, setShowPasswords] = useState<{
    [key: string]: boolean;
  }>({});

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'user' as 'admin' | 'user'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const s = io();
    setSocket(s);

    // Request full presence snapshot
    s.emit('get-presence');

    s.on('presence-state', ({ userIds }: { userIds: string[] }) => {
      setPresence(() => {
        const next: Record<string, boolean> = {};
        for (const id of userIds) next[id] = true;
        return next;
      });
    });

    s.on(
      'user-status-change',
      ({ userId, isOnline }: { userId: string; isOnline: boolean }) => {
        setPresence(prev => ({ ...prev, [userId]: isOnline }));
      }
    );

    return () => {
      s.disconnect();
    };
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchUsers();
        toast.success('User created successfully!');
        setShowCreateDialog(false);
        setFormData({ username: '', password: '', role: 'user' });
      }
    } catch (error: any) {
      toast.error('Error creating user!', {
        description: error.message || 'Something went wrong!'
      });
      console.error('Error creating user:', error);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/admin/users/${editingUser._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        await fetchUsers();
        toast.success('User updated successfully!');
        setEditingUser(null);
        setFormData({ username: '', password: '', role: 'user' });
      }
    } catch (error: any) {
      toast.error('Error updating user!', {
        description: error.message || 'Something went wrong!'
      });
      console.error('Error updating user:', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('User deleted successfully!');
        await fetchUsers();
      }
    } catch (error: any) {
      toast.error('Error deleting user!', {
        description: error.message || 'Something went wrong!'
      });
      console.error('Error deleting user:', error);
    }
  };

  const togglePasswordVisibility = (userId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const onlineCount = useMemo(
    () =>
      users.reduce((acc, u) => {
        const id = (u as any)._id?.toString?.() || '';
        return acc + (presence[id] ? 1 : 0);
      }, 0),
    [users, presence]
  );

  if (loading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>User Management</CardTitle>
          <p className="text-sm text-muted-foreground">
            Online: {onlineCount} / {users.length}
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={e =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={e =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value: 'admin' | 'user') =>
                    setFormData({ ...formData, role: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Password</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(user => {
                const uid = (user as any)._id?.toString?.() || '';
                const isOnline = !!presence[uid];

                return (
                  <TableRow key={uid}>
                    <TableCell className="font-mono text-xs">
                      {uid.slice(-8)}
                    </TableCell>
                    <TableCell>{user.username}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">
                          {showPasswords[uid || '']
                            ? user.password
                            : '••••••••••••••••••••'}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => togglePasswordVisibility(uid || '')}
                        >
                          {showPasswords[uid || ''] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          user.role === 'admin' ? 'default' : 'secondary'
                        }
                      >
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isOnline ? 'default' : 'secondary'}>
                        {isOnline ? 'Online' : 'Offline'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user);
                            setFormData({
                              username: user.username,
                              password: '',
                              role: user.role
                            });
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteUser(uid || '')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {editingUser && (
          <Dialog
            open={!!editingUser}
            onOpenChange={() => setEditingUser(null)}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <Label htmlFor="edit-username">Username</Label>
                  <Input
                    id="edit-username"
                    value={formData.username}
                    onChange={e =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-password">
                    Password (leave empty to keep current)
                  </Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={formData.password}
                    onChange={e =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: 'admin' | 'user') =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">
                  Update User
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
