import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink p-6">
      <section className="w-full max-w-md rounded-md border border-slate-200 bg-white p-8 shadow-touch">
        <div className="flex justify-center">
          <img src="/brand/mill-wordmark.svg" alt="The Mill Wood Systems" className="brand-wordmark h-24 max-w-full" />
        </div>
        <p className="mt-6 text-center text-lg font-bold text-steel">Wall production tracker</p>
        <LoginForm />
      </section>
    </main>
  );
}
