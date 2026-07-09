import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-ink p-6">
      <section className="w-full max-w-md rounded-md bg-white p-8 shadow-touch">
        <h1 className="text-4xl font-black text-ink">PanelTrack</h1>
        <p className="mt-2 text-lg text-steel">Sign in to the shop floor tracker.</p>
        <LoginForm />
      </section>
    </main>
  );
}
