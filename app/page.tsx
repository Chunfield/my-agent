import { type Metadata } from 'next';
import ChatApp from '@/components/ChatApp';

export const metadata: Metadata = {
  title: 'DeepSeek Agent',
};

interface PageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams;
  const preview = params.preview;

  return (
    <ChatApp
      forceLoggedIn={preview === 'logged-in'}
      forceLoggedOut={preview === 'logged-out'}
    />
  );
}
