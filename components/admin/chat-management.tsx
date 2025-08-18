'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Users,
  MessageSquareText,
  Trash2,
  Shield,
  Settings,
  Search
} from 'lucide-react';
import { Message } from '@/lib/models/client';
import { io, type Socket } from 'socket.io-client';

type AdminChat = {
  _id: string;
  type: 'individual' | 'group';
  name?: string;
  createdAt: string;
  lastMessage?: { content: string; sender: string; timestamp: string };
  participants: { _id: string; username: string }[];
};

export default function ChatManagement() {
  const [socket, setSocket] = useState<Socket | null>(null);

  const [chats, setChats] = useState<AdminChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<AdminChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [search, setSearch] = useState('');
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingOne, setDeletingOne] = useState<null | string>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () =>
    endRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL);
    setSocket(socketInstance);
    initialize();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initialize = async () => {
    setLoading(true);
    try {
      await fetchChats();
    } finally {
      setLoading(false);
    }
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/admin/chats');
      if (res.ok) {
        const data: AdminChat[] = await res.json();
        setChats(data);
        if (data.length > 0) {
          setSelectedChat(prev => {
            if (prev) {
              // Preserve selection if still present
              const stillThere = data.find(c => c._id === prev._id);
              return stillThere || data[0];
            }
            return data[0];
          });
        } else {
          setSelectedChat(null);
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('Failed to load chats', e);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const res = await fetch(`/api/admin/messages/${chatId}`);
      if (res.ok) {
        const data: Message[] = await res.json();
        setMessages(data);
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.error('Failed to load messages', e);
    }
  };

  const handleSelectChat = (chat: AdminChat) => {
    setSelectedChat(chat);
    void fetchMessages(chat._id);
  };

  useEffect(() => {
    if (selectedChat?._id) {
      void fetchMessages(selectedChat._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?._id]);

  const filteredChats = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter(c => {
      const title = (c.name || `Chat ${c._id.slice(-4)}`).toLowerCase();
      const participantNames = c.participants
        .map(p => p.username.toLowerCase())
        .join(' ');
      const last = c.lastMessage?.content?.toLowerCase() ?? '';
      return (
        title.includes(q) ||
        participantNames.includes(q) ||
        c.type.includes(q) ||
        c._id.toLowerCase().includes(q) ||
        last.includes(q)
      );
    });
  }, [chats, search]);

  const deleteSelectedChat = async () => {
    if (!selectedChat) return;
    setDeletingOne(selectedChat._id);
    try {
      socket?.emit('chat-deleted', {
        participants: selectedChat.participants.map(p => p._id),
        chatId: selectedChat._id
      });
      const res = await fetch(`/api/admin/chats/${selectedChat._id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await fetchChats();
      }
    } catch (e) {
      console.error('Failed to delete chat', e);
    } finally {
      setDeletingOne(null);
    }
  };

  const deleteAllChats = async () => {
    setDeletingAll(true);
    try {
      socket?.emit('chat-deleted', {
        all: true
      });
      const res = await fetch(`/api/admin/chats?all=1`, { method: 'DELETE' });
      if (res.ok) {
        setSelectedChat(null);
        setMessages([]);
        await fetchChats();
      }
    } catch (e) {
      console.error('Failed to delete all chats', e);
    } finally {
      setDeletingAll(false);
    }
  };

  const formatTime = (iso: string | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="ant-card border-blue-100">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Chat Management</CardTitle>
          </div>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
            <DeleteAllButton onConfirm={deleteAllChats} loading={deletingAll} />
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Chats list */}
        <Card className="ant-card border-blue-100 md:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquareText className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">All Chats</CardTitle>
              </div>
              <Badge
                variant="secondary"
                className="bg-blue-50 border text-primary"
              >
                {chats.length}
              </Badge>
            </div>
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search chats, participants, content..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 ant-input"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[60vh]">
              <div className="divide-y">
                {loading ? (
                  <div className="p-4 text-sm text-gray-500">Loading...</div>
                ) : filteredChats.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">
                    No chats found.
                  </div>
                ) : (
                  filteredChats.map(chat => {
                    const active = selectedChat?._id === chat._id;
                    return (
                      <button
                        key={chat._id}
                        onClick={() => handleSelectChat(chat)}
                        className={`w-full text-left p-3 hover:bg-blue-50 transition ${
                          active ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {chat.type === 'group' ? (
                              <Users className="w-4 h-4 text-primary" />
                            ) : (
                              <MessageSquareText className="w-4 h-4 text-primary" />
                            )}
                            <span className="font-medium text-sm">
                              {chat.name || `Chat ${chat._id.slice(-4)}`}
                            </span>
                          </div>
                          <Badge variant="outline" className="border-blue-100">
                            {chat.participants.length}
                          </Badge>
                        </div>
                        {chat.lastMessage && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">
                            {chat.lastMessage.content}
                          </p>
                        )}
                        <div className="text-[11px] text-gray-400 mt-1">
                          {formatTime(chat.lastMessage?.timestamp)}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Messages panel */}
        <Card className="ant-card border-blue-100 md:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">Chat Details</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-blue-100">
                  {selectedChat?.type ?? '—'}
                </Badge>
                <DeleteOneButton
                  onConfirm={deleteSelectedChat}
                  disabled={!selectedChat}
                  loading={!!deletingOne}
                />
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {selectedChat ? (
                <>
                  <span className="font-medium text-primary">
                    {selectedChat.name || `Chat ${selectedChat._id.slice(-4)}`}
                  </span>{' '}
                  • Created {formatTime(selectedChat.createdAt)}
                </>
              ) : (
                'Select a chat to inspect messages and participants.'
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedChat ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Messages */}
                <div className="lg:col-span-2">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MessageSquareText className="w-4 h-4" />
                      <span className="text-sm">Messages</span>
                    </div>
                  </div>
                  <div className="border rounded-md">
                    <ScrollArea className="h-[48vh] p-3">
                      <div className="space-y-3">
                        {messages.length === 0 ? (
                          <div className="text-sm text-gray-500">
                            No messages in this chat.
                          </div>
                        ) : (
                          messages.map(m => (
                            <div key={m._id} className="flex flex-col gap-1">
                              <div className="text-xs text-gray-500">
                                <span className="font-medium">
                                  {selectedChat.participants.find(
                                    p => p._id === m.sender
                                  )?.username || m.sender}
                                </span>{' '}
                                <span className="opacity-70">
                                  at {formatTime(m.timestamp)}
                                </span>
                              </div>
                              <div
                                className={`rounded-md border p-2 ${
                                  m.type === 'image'
                                    ? 'bg-white'
                                    : 'bg-blue-50 border-blue-100'
                                }`}
                              >
                                {m.type === 'image' ? (
                                  <img
                                    src={
                                      m.image?.imageUrl ||
                                      '/placeholder.svg?height=200&width=320&query=chat-image'
                                    }
                                    alt="message image"
                                    className="max-h-64 rounded"
                                  />
                                ) : (
                                  <p className="text-sm text-gray-800">
                                    {m.content}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                        <div ref={endRef} />
                      </div>
                    </ScrollArea>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Admin is read-only here. Messaging is disabled for admin
                    accounts.
                  </p>
                </div>
                {/* Participants */}
                <div className="lg:col-span-1">
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Participants</span>
                    <Badge
                      variant="secondary"
                      className="ml-auto bg-blue-50 border text-primary"
                    >
                      {selectedChat.participants.length}
                    </Badge>
                  </div>
                  <div className="border rounded-md">
                    <ScrollArea className="h-[48vh]">
                      <ul className="divide-y">
                        {selectedChat.participants.map(p => (
                          <li key={p._id} className="p-3 text-sm">
                            {p.username}
                            <div className="text-[11px] text-gray-400 font-mono">
                              {p._id.slice(-8)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No chat selected.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DeleteOneButton({
  onConfirm,
  disabled,
  loading
}: {
  onConfirm: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        disabled={disabled || loading}
        className="bg-red-500 hover:bg-red-600 text-white"
      >
        <Trash2 className="w-4 h-4 mr-2" />
        {loading ? 'Deleting...' : 'Delete Chat'}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            This will permanently delete the chat and all of its messages. This
            action cannot be undone.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DeleteAllButton({
  onConfirm,
  loading
}: {
  onConfirm: () => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="destructive"
        onClick={() => setOpen(true)}
        className="bg-red-500 hover:bg-red-600 text-white"
        disabled={loading}
      >
        <Trash2 className="w-4 h-4 mr-2" />
        {loading ? 'Deleting...' : 'Delete All'}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all chats?</AlertDialogTitle>
          </AlertDialogHeader>
          <p className="text-sm text-gray-600">
            This will permanently delete all chats and messages across the
            system. This action cannot be undone.
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600 text-white"
              onClick={() => {
                onConfirm();
                setOpen(false);
              }}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
