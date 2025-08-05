'use client';

import type React from 'react';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, ImageIcon, Users, MessageCircle } from 'lucide-react';
import { io, type Socket } from 'socket.io-client';
import type { Chat, Message, User } from '@/lib/models';

interface ChatInterfaceProps {
  currentUser: User;
}

export default function ChatInterface({ currentUser }: ChatInterfaceProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL);
    setSocket(socketInstance);
    // Emit user online status
    socketInstance.emit('user-online', currentUser._id?.toString());

    // Listen for new messages
    socketInstance.on('new-message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for message read receipts
    socketInstance.on('messages-read', data => {
      setMessages(prev =>
        prev.map(msg => ({
          ...msg,
          readBy: [...msg.readBy, { userId: data.userId, readAt: new Date() }]
        }))
      );
    });

    fetchChats();

    return () => {
      socketInstance.disconnect();
    };
  }, [currentUser._id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      const response = await fetch('/api/chats');
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
  };

  const fetchMessages = async (chatId: string) => {
    try {
      const response = await fetch(`/api/messages/${chatId}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);

        // Mark messages as read
        if (socket) {
          socket.emit('mark-read', {
            chatId,
            userId: currentUser._id?.toString()
          });
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleChatSelect = (chat: Chat) => {
    if (selectedChat) {
      socket?.emit('leave-chat', selectedChat._id?.toString());
    }

    setSelectedChat(chat);
    socket?.emit('join-chat', chat._id?.toString());
    fetchMessages(chat._id?.toString() || '');
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !socket) return;

    const messageData = {
      chatId: selectedChat._id?.toString(),
      sender: currentUser._id?.toString(),
      content: newMessage,
      type: 'text'
    };

    socket.emit('send-message', messageData);
    setNewMessage('');
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat List */}
      <div className="w-1/3 border-r bg-white">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Chats</h2>
        </div>
        <ScrollArea className="h-full">
          <div className="p-2">
            {chats.map(chat => (
              <Card
                key={chat._id?.toString()}
                className={`mb-2 cursor-pointer transition-colors ${
                  selectedChat?._id?.toString() === chat._id?.toString()
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
                        {chat.name || `Chat ${chat._id?.toString().slice(-4)}`}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {chat.participants.length}
                    </Badge>
                  </div>
                  {chat.lastMessage && (
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {chat.lastMessage.content}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center gap-2">
                {selectedChat.type === 'group' ? (
                  <Users className="w-5 h-5" />
                ) : (
                  <MessageCircle className="w-5 h-5" />
                )}
                <h3 className="text-lg font-semibold">
                  {selectedChat.name ||
                    `Chat ${selectedChat._id?.toString().slice(-4)}`}
                </h3>
                <Badge variant="outline">
                  {selectedChat.participants.length} participants
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                {messages.map(message => (
                  <div
                    key={message._id?.toString()}
                    className={`flex ${
                      message.sender.toString() === currentUser._id?.toString()
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        message.sender.toString() ===
                        currentUser._id?.toString()
                          ? 'bg-blue-500 text-white'
                          : 'bg-white border'
                      }`}
                    >
                      <p className="text-sm">{message.content}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs opacity-70">
                          {formatTime(message.timestamp)}
                        </span>
                        {message.sender.toString() ===
                          currentUser._id?.toString() && (
                          <span className="text-xs opacity-70">
                            {message.readBy.length > 1 ? '✓✓' : '✓'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t bg-white">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="icon">
                  <ImageIcon className="w-4 h-4" />
                </Button>
                <Button type="submit" size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
