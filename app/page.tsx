'use client';

import {
  useState,
  useRef,
  useEffect,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  Menu,
  Plus,
  MessageSquare,
  Bot,
  User,
  Clock,
  StopCircle,
  LogOut,
} from 'lucide-react';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { signIn, signOut, useSession } from 'next-auth/react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

function getTextFromUIMessage(m: UIMessage): string {
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

export default function Home() {
  const { data: session } = useSession();

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/deepseek',
      body: {
        chatId: currentChatId,
      },
    }),
    messages: chatMessages,
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  const [input, setInput] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [serverDate, setServerDate] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipLoading, setTooltipLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (session?.user) {
      void fetchChats();
    }
  }, [session]);

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const data = await res.json();
        setChats(data);
      }
    } catch (e) {
      console.error('Failed to fetch chats', e);
    }
  };

  const handleSubmit = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();

    if (isLoading) {
      await stop();
      return;
    }

    const text = input.trim();
    if (!text) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage({ text });
    await fetchChats();
  };

  const submitText = async () => {
    if (isLoading) return;

    const text = input.trim();
    if (!text) return;

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    await sendMessage({ text });
    await fetchChats();
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const firstUserText = (() => {
    const firstUser = messages.find((m) => m.role === 'user');
    return firstUser ? getTextFromUIMessage(firstUser) : '';
  })();

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
    setCurrentChatId(null);
    setChatMessages([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSelectChat = async (chatId: string) => {
    setCurrentChatId(chatId);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        const loadedMessages = data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }));
        setChatMessages(loadedMessages);
        setMessages(loadedMessages as any);
      }
    } catch (e) {
      console.error('Failed to load chat messages', e);
    }
  };

  const fetchServerDate = async () => {
    setTooltipLoading(true);
    try {
      const res = await fetch('/api/server-date');
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerDate(typeof data?.date === 'string' ? data.date : '');
      }
    } catch {
      setServerDate('获取失败');
    } finally {
      setTooltipLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white text-gray-900 font-sans overflow-hidden">
      <aside
        className={cn(
          'flex-shrink-0 bg-[#f9f9f9] border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col',
          isSidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-none'
        )}
      >
        <div className="p-3 flex flex-col h-full w-64">
          <button
            onClick={handleNewChat}
            className="flex items-center gap-2 w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            新对话
          </button>

          <div className="mt-6 flex-1 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-400 mb-2 px-2">历史记录</div>
            {chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => void handleSelectChat(chat.id)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-200 rounded-md cursor-pointer transition-colors',
                  currentChatId === chat.id ? 'bg-gray-200' : ''
                )}
              >
                <MessageSquare className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{chat.title}</span>
              </div>
            ))}
          </div>

          {session?.user && (
            <div className="mt-auto pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2 px-2">
                {session.user.image && (
                  <img
                    src={session.user.image}
                    alt={session.user.name ?? 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {session.user.name}
                  </p>
                </div>
                <button
                  onClick={() => void signOut()}
                  className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                  title="退出登录"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full relative min-w-0">
        <header className="h-14 flex items-center justify-between px-4 flex-shrink-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
              title={isSidebarOpen ? '收起侧边栏' : '展开侧边栏'}
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-base font-medium text-gray-800 hidden sm:block">
              DeepSeek Agent
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {session?.user ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-gray-100 text-gray-600">
                <img
                  src={session.user.image ?? ''}
                  alt=""
                  className="w-5 h-5 rounded-full"
                />
                <span className="hidden sm:inline">{session.user.name}</span>
              </div>
            ) : (
              <button
                onClick={() => void signIn('github')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-gray-800 text-white hover:bg-gray-700 transition-colors"
              >
                <GithubIcon className="w-4 h-4" />
                <span>登录</span>
              </button>
            )}

            <div
              className="relative inline-block"
              onMouseEnter={() => {
                setShowTooltip(true);
                void fetchServerDate();
              }}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>服务器时间</span>
              </button>
              {showTooltip && (
                <div className="absolute right-0 mt-2 z-50 rounded-md bg-gray-800 text-white text-xs px-3 py-2 shadow-lg whitespace-nowrap">
                  {tooltipLoading ? '加载中...' : serverDate || '无数据'}
                </div>
              )}
            </div>

            <div className="text-xs text-gray-400 border border-gray-200 rounded-md px-2 py-1">
              deepseek-chat
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pb-36 px-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                <Bot className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-xl font-medium text-gray-700 mb-2">
                我是 DeepSeek
              </p>
              <p className="text-sm text-gray-500">很高兴见到你，有什么我可以帮忙的吗？</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full py-6 flex flex-col gap-6">
              {messages.map((m: UIMessage) => {
                const content = getTextFromUIMessage(m);

                return (
                  <div
                    key={m.id}
                    className={cn(
                      'flex gap-4 w-full',
                      m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white mt-1',
                        m.role === 'user' ? 'bg-gray-800' : 'bg-blue-600'
                      )}
                    >
                      {m.role === 'user' ? (
                        <User className="w-5 h-5" />
                      ) : (
                        <Bot className="w-5 h-5" />
                      )}
                    </div>

                    <div
                      className={cn(
                        'max-w-[85%] sm:max-w-[75%]',
                        m.role === 'user'
                          ? 'bg-gray-100 px-5 py-3 rounded-2xl rounded-tr-sm text-gray-800'
                          : 'text-gray-800 pt-1'
                      )}
                    >
                      {m.role === 'user' ? (
                        <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
                          {content}
                        </div>
                      ) : (
                        <div className="prose prose-sm sm:prose-base max-w-none prose-p:leading-relaxed prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-a:text-blue-600">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex gap-4 w-full">
                  <div className="w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-white bg-blue-600 mt-1">
                    <Bot className="w-5 h-5" />
                  </div>
                  <div className="text-gray-500 pt-3 flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white/95 to-transparent pt-6 pb-6 px-4">
          <div className="max-w-3xl mx-auto">
            {!session?.user && (
              <div className="mb-2 text-center">
                <button
                  onClick={() => void signIn('github')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <GithubIcon className="w-4 h-4" />
                  登录后记录对话
                </button>
              </div>
            )}
            <form
              onSubmit={(e: FormEvent<HTMLFormElement>) => {
                void handleSubmit(e);
              }}
              className="relative flex items-end gap-2 bg-white border border-gray-300 rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 transition-shadow p-2"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void submitText();
                  }
                }}
                placeholder={
                  session?.user ? '发送消息给 DeepSeek...' : '请先登录'
                }
                disabled={!session?.user}
                className="flex-1 max-h-48 min-h-[44px] w-full resize-none bg-transparent px-3 py-2.5 text-[15px] text-gray-800 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
              />
              <button
                type={isLoading ? 'button' : 'submit'}
                onClick={isLoading ? stop : undefined}
                disabled={(!input.trim() && !isLoading) || !session?.user}
                className={cn(
                  'p-2.5 rounded-xl flex-shrink-0 transition-all mb-1',
                  (input.trim() || isLoading) && session?.user
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                )}
              >
                {isLoading ? (
                  <StopCircle className="w-5 h-5 ml-0.5" />
                ) : (
                  <Send className="w-5 h-5 ml-0.5" />
                )}
              </button>
            </form>
            <div className="flex justify-between items-center mt-2 px-2">
              <div className="text-[11px] text-gray-400">
                内容由 AI 生成，请仔细甄别。
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
