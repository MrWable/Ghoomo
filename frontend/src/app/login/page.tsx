import { LoginForm } from '@/components/login-form';

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <main className="pb-16 pt-8">
      <div className="page-shell">
        <LoginForm nextPath={resolvedSearchParams?.next} />
      </div>
    </main>
  );
}
