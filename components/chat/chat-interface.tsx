'use client';

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import NextImage from 'next/image';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import {
  Send,
  Image,
  Users,
  MessageCircle,
  Plus,
  Search,
  User,
  Check,
  Download
} from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import type { Chat, Message, User as UserType } from '@/lib/models/client';

type ChatType = Chat & {
  participantUsers: {
    _id: string;
    username: string;
  }[];
  lastMessage?: {
    _id?: string;
    content: string;
    sender: string;
    timestamp: string;
    readBy?: { userId: string; readAt: string }[];
  };
};

type MessageType = Message & {
  sender: {
    _id: string;
    username: string;
  };
};

export default function ChatInterface({
  currentUser
}: {
  currentUser: UserType;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);

  const [chats, setChats] = useState<ChatType[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [users, setUsers] = useState<UserType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [isGroupMode, setIsGroupMode] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [imagePreview, setImagePreview] = useState<Message['image']>();

  const playNotificationSound = (chatId: string) => {
    if (audioRef.current && selectedChat?._id !== chatId) {
      audioRef.current.play().catch(error => {
        // Handle errors, e.g., user hasn't interacted with page yet so autoplay blocked
        console.log('Error playing sound:', error);
      });
    }
  };

  // ===== SOCKET INIT =====
  useEffect(() => {
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL);
    setSocket(socketInstance);

    socketInstance.emit('user-online', currentUser._id);

    const handleNewMessage = (message: MessageType) => {
      socketInstance.emit('mark-read', {
        chatId: message.chatId,
        userId: currentUser._id
      });
      setMessages(prev =>
        prev.some(m => m._id === message._id) ? prev : [...prev, message]
      );
    };

    socketInstance.on('new-message', handleNewMessage);

    socketInstance.on('messages-read', (data, chat) => {
      setMessages(prev =>
        prev.map(msg =>
          msg.readBy.some(r => r.userId === data.userId)
            ? msg
            : {
                ...msg,
                readBy: [
                  ...msg.readBy,
                  { userId: data.userId, readAt: data.readAt }
                ]
              }
        )
      );
      setChats(prev => prev.map(p => (p._id === chat._id ? chat : p)));
    });

    socketInstance.on('new-chat-created', (chat: ChatType) => {
      setChats(prev => [chat, ...prev]);
    });

    socketInstance.on(
      'chat-last-message-updated',
      (chat: ChatType, sender: string) => {
        setChats(prev => [chat, ...prev.filter(p => p._id !== chat._id)]);
        if (sender !== currentUser._id) playNotificationSound(chat._id!);
      }
    );

    socketInstance.on('delete-client-chats', data => {
      const { all, chatId } = data;
      if (all) {
        setSelectedChat(null);
        setChats([]);
        setMessages([]);
      } else {
        setChats(prev => prev.filter(p => p._id !== chatId));
        setSelectedChat(null);
      }
    });

    fetchChats();

    return () => {
      socketInstance.off('new-message', handleNewMessage);
      socketInstance.off('messages-read');
      socketInstance.off('new-chat-created');
      socketInstance.disconnect();
    };
  }, [currentUser._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // ===== FETCHING =====
  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        // Sort chats by lastMessage.timestamp descending
        const sortedChats = [...data].sort((a, b) => {
          const aTime = a.lastMessage?.timestamp
            ? new Date(a.lastMessage.timestamp).getTime()
            : 0;
          const bTime = b.lastMessage?.timestamp
            ? new Date(b.lastMessage.timestamp).getTime()
            : 0;
          return bTime - aTime;
        });
        setChats(sortedChats);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        const filteredUsers = data.filter(
          (user: UserType) => user._id !== currentUser._id
        );
        setUsers(filteredUsers);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/messages/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);

        socket?.emit('mark-read', {
          chatId,
          userId: currentUser._id
        });
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // ===== CHAT ACTIONS =====
  const handleChatSelect = (chat: ChatType) => {
    if (selectedChat) {
      socket?.emit('leave-chat', selectedChat._id);
    }
    setSelectedChat(chat);
    socket?.emit('join-chat', chat._id);
    fetchMessages(chat._id || '');
  };

  const handleSendMessage = async (e?: React.FormEvent, file?: File) => {
    if (e) e.preventDefault();
    if (
      (!newMessage.trim() && !file) ||
      !selectedChat?._id ||
      !socket ||
      !currentUser._id
    )
      return;
    let image;
    if (file) {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/image-upload', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
      const result = await response.json();
      image = result;
    }

    const optimisticMessage = {
      chatId: selectedChat._id,
      sender: currentUser._id,
      content: newMessage.trim(),
      image,
      type: image ? 'image' : 'text'
    };

    setNewMessage('');

    socket.emit('send-message', optimisticMessage);
  };

  const handleNewChatOpen = (group = false) => {
    setIsGroupMode(group);
    setIsNewChatOpen(true);
    fetchUsers();
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createChat = async (otherUserId: string, otherUserName: string) => {
    setIsCreatingChat(true);
    try {
      const existingChat = chats.find(
        chat =>
          chat.type === 'individual' &&
          chat.participants.some(p => p === otherUserId)
      );

      if (existingChat) {
        setIsNewChatOpen(false);
        handleChatSelect(existingChat);
        setIsCreatingChat(false);
        return;
      }

      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: [otherUserId],
          type: 'individual',
          name: otherUserName
        })
      });

      if (response.ok) {
        const newChat: ChatType = await response.json();
        setIsNewChatOpen(false);
        setSearchQuery('');
        handleChatSelect(newChat);

        if (
          socket &&
          newChat.participantUsers &&
          newChat.participantUsers.length > 0
        ) {
          socket.emit('chat-created', {
            chat: newChat,
            participantIds: newChat.participantUsers.map(pu => pu._id)
          });
        }
        socket?.emit('new-chat', newChat);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsers.length < 2) return;
    setIsCreatingChat(true);
    try {
      const response = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participants: selectedUsers,
          type: 'group',
          name: groupName
        })
      });

      if (response.ok) {
        const newChat = await response.json();
        setChats(prev => [newChat, ...prev]);
        setIsNewChatOpen(false);
        setSearchQuery('');
        setGroupName('');
        setSelectedUsers([]);
        handleChatSelect(newChat);
        socket?.emit('new-chat', newChat);
      }
    } catch (error) {
      console.error('Error creating group:', error);
    } finally {
      setIsCreatingChat(false);
    }
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

  const filteredUsers = users.filter(user =>
    user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ===== RENDER =====
  return (
    <div className="flex h-full bg-gray-50">
      <audio ref={audioRef} src="/notification.wav" preload="auto" />
      {/* Chat List */}
      <div className="w-1/3 border-r bg-white">
        <div className="border-b h-16 flex items-center w-full px-4">
          <div className="flex w-full items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Chats</h2>
            <Button size="sm" onClick={() => handleNewChatOpen(false)}>
              <Plus className="w-4 h-4 mr-1" /> New
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleNewChatOpen(true)}
            >
              <Users className="w-4 h-4 mr-1" /> Group
            </Button>
          </div>
        </div>
        <ScrollArea className="h-full">
          <div className="p-2">
            {chats.map(chat => {
              // Determine if chat has unread messages for current user
              let hasUnread = false;
              let lastMsgPreview = '';
              let lastMsgTime = '';
              if (chat.lastMessage?.content) {
                const lastRead = chat.lastMessage.readBy?.find(
                  (r: { userId: string; readAt: string }) =>
                    r.userId === currentUser._id
                )?.readAt;
                lastMsgTime = chat.lastMessage.timestamp;
                hasUnread =
                  !!lastMsgTime &&
                  (!lastRead ||
                    new Date(lastMsgTime) > new Date(lastRead || 0));
                lastMsgPreview =
                  chat.lastMessage.content.length > 30
                    ? chat.lastMessage.content.slice(0, 30) + '...'
                    : chat.lastMessage.content;
              }
              return (
                <Card
                  key={chat._id}
                  className={`mb-2 cursor-pointer transition-colors ${
                    selectedChat?._id === chat._id
                      ? 'bg-blue-50 border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleChatSelect(chat)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {chat.type === 'group' ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          <MessageCircle className="w-4 h-4" />
                        )}
                        <span className="font-medium">
                          {chat.type === 'individual'
                            ? chat.participantUsers.find(
                                u => u._id !== currentUser._id
                              )?.username
                            : chat.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {chat.participants.length}
                        </Badge>
                        {hasUnread && (
                          <span
                            className="ml-2 inline-block w-2 h-2 rounded-full bg-blue-500"
                            title="New message"
                          />
                        )}
                      </div>
                    </div>
                    {chat.lastMessage ? (
                      <div className="mt-2 text-xs text-gray-500 flex justify-between">
                        <span>{lastMsgPreview}</span>
                        <span>
                          {chat.lastMessage.timestamp
                            ? formatTime(chat.lastMessage.timestamp)
                            : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-gray-400 italic">
                        No messages yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="px-4 flex items-center w-full border-b bg-white h-16">
              <div className="flex items-center gap-2">
                {selectedChat.type === 'group' ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <MessageCircle className="w-5 h-5" />
                )}
                <h3 className="text-lg font-semibold">
                  {selectedChat.type === 'individual'
                    ? selectedChat.participantUsers.find(
                        u => u._id !== currentUser._id
                      )?.username
                    : selectedChat.name}
                </h3>
                <Badge variant="outline">
                  {selectedChat.participants.length} participants
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <div
              className="flex-1 p-4 overflow-y-auto"
              ref={messagesContainerRef}
            >
              <div className="space-y-4">
                {messages.map(message => {
                  const isCurrentUser = message.sender._id === currentUser._id;

                  return (
                    <div
                      key={message._id || Math.random()}
                      className={`flex ${
                        isCurrentUser ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div>
                        {/* Show username for other users */}
                        {!isCurrentUser && (
                          <p className="text-xs font-medium opacity-70 mb-0.5">
                            {message.sender.username || 'Unknown User'}
                          </p>
                        )}

                        <div
                          className={`max-w-xs lg:max-w-md px-2 py-2 rounded-lg ${
                            isCurrentUser
                              ? 'bg-blue-500 text-white'
                              : 'bg-white border'
                          }`}
                        >
                          {message.content ? (
                            <p className="text-sm break-words">
                              {message.content}
                            </p>
                          ) : message.image ? (
                            <div className="relative group">
                              <NextImage
                                src={message.image.imageUrl}
                                alt={message.image.originalName}
                                height={1000}
                                width={1000}
                                onClick={() => setImagePreview(message.image)}
                                className="rounded-md cursor-pointer"
                              />
                              {/* Download button (appears on hover) */}
                              <a
                                href={message.image.imageUrl}
                                download={message.image.originalName}
                                onClick={e => e.stopPropagation()}
                                className="absolute bottom-2 right-2"
                              >
                                <Button
                                  size="icon"
                                  variant="secondary"
                                  className="bg-black/70 hover:bg-black text-white rounded-full p-2"
                                >
                                  <Download className="h-5 w-5" />
                                </Button>
                              </a>
                            </div>
                          ) : null}
                          <div className="flex items-center justify-between mt-1 gap-2">
                            <span className="text-xs opacity-70">
                              {formatTime(message.timestamp)}
                            </span>
                            {isCurrentUser && (
                              <span className="flex items-center text-xs">
                                {message.readBy.length > 1 ? (
                                  <>
                                    <Check
                                      size={12}
                                      className="text-blue-200 -mr-2"
                                    />
                                    <Check
                                      size={12}
                                      className="text-blue-200"
                                    />
                                  </>
                                ) : (
                                  <Check size={12} className="text-gray-200" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 border-t bg-white flex gap-2"
            >
              <Input
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={async () => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = false;

                  input.onchange = (event: Event) => {
                    const file = (event.target as HTMLInputElement)?.files?.[0];
                    if (file) {
                      if (!file.type.startsWith('image/')) {
                        alert('Please select an image file only.');
                        return;
                      }
                      handleSendMessage(undefined, file);
                    }
                  };

                  input.click();
                }}
              >
                <Image className="w-4 h-4" />
              </Button>
              <Button type="submit" size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-4">
                Select a chat to start messaging
              </p>
              <Button onClick={() => handleNewChatOpen(false)} className="mr-2">
                <Plus className="w-4 h-4" /> Start New Chat
              </Button>
              <Button variant="outline" onClick={() => handleNewChatOpen(true)}>
                <Users className="w-4 h-4" /> Start Group Chat
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Dialog */}
      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isGroupMode ? 'Create Group Chat' : 'Start New Chat'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isGroupMode && (
              <Input
                placeholder="Group Name"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
              />
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-64">
              <div className="space-y-2">
                {filteredUsers.map(user => (
                  <Card
                    key={user._id}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      isGroupMode && selectedUsers.includes(user._id!)
                        ? 'bg-blue-100'
                        : ''
                    }`}
                    onClick={() =>
                      isGroupMode
                        ? toggleUserSelection(user._id!)
                        : createChat(user._id!, user.username || '')
                    }
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{user.username}</p>
                      </div>
                      {isCreatingChat && !isGroupMode && (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      )}
                    </CardContent>
                  </Card>
                ))}
                {filteredUsers.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    No users found
                  </div>
                )}
              </div>
            </ScrollArea>
            {isGroupMode && (
              <Button
                disabled={
                  isCreatingChat ||
                  selectedUsers.length < 2 ||
                  !groupName.trim()
                }
                onClick={createGroupChat}
                className="w-full"
              >
                {isCreatingChat ? 'Creating...' : 'Create Group Chat'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image preview dialog */}
      <Dialog
        open={!!imagePreview}
        onOpenChange={open => !open && setImagePreview(undefined)}
      >
        <DialogContent className="max-w-5xl p-0 bg-transparent border-none shadow-none">
          {imagePreview ? (
            <NextImage
              src={imagePreview.imageUrl}
              alt={imagePreview.originalName}
              height={1000}
              width={1000}
              className="rounded-lg object-contain max-h-[90vh] w-auto"
            />
          ) : (
            'No Preview Available'
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
