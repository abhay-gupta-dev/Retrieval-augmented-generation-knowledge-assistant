import { useEffect, useState } from "react";
import { Check, CreditCard, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { createBillingOrder, getBillingStatus, listAdminBillingOrders, verifyBillingPayment, type BillingOrder, type BillingStatus, type RazorpayOrder } from "../services/api";

type CheckoutResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, callback: (value: { error?: { description?: string } }) => void) => void };
type RazorpayOptions = {
  key: string; order_id: string; amount: number; currency: string; name: string; description: string;
  prefill: { name: string; email: string }; theme: { color: string };
  handler: (result: CheckoutResult) => void;
  modal: { ondismiss: () => void };
};
declare global { interface Window { Razorpay?: new (options: RazorpayOptions) => RazorpayInstance } }

const products = [
  { code: "reply_1", price: "₹3", title: "1 AI reply", detail: "One reply for a quick question" },
  { code: "reply_15", price: "₹20", title: "15 AI replies", detail: "Save ₹25 compared with single replies", badge: "Popular" },
  { code: "monthly", price: "₹60", title: "Monthly", detail: "100 replies for 30 days · one-time payment" },
  { code: "six_month", price: "₹300", title: "6 months", detail: "100 replies every 30 days · 180 days · one-time payment", badge: "Best value" },
];

async function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return;
  const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout="true"]');
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Could not load secure payment checkout.")), { once: true });
    });
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load secure payment checkout."));
    document.body.appendChild(script);
  });
}

export function BillingPage() {
  const { isGuest } = useAuth();
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [ownerOrders, setOwnerOrders] = useState<BillingOrder[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState("");

  async function reload() {
    const state = await getBillingStatus();
    setBilling(state);
    if (state.is_owner) setOwnerOrders(await listAdminBillingOrders());
  }

  useEffect(() => {
    let active = true;
    void getBillingStatus().then(async (state) => {
      if (!active) return;
      setBilling(state);
      if (state.is_owner) {
        const orders = await listAdminBillingOrders();
        if (active) setOwnerOrders(orders);
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Could not load billing details."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function purchase(productCode: string) {
    setBuying(productCode);
    setError("");
    setNotice("");
    try {
      const order: RazorpayOrder = await createBillingOrder(productCode);
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Secure payment checkout is unavailable. Refresh and try again.");
      const checkout = new window.Razorpay({
        key: order.key_id,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: order.name,
        description: order.description,
        prefill: order.prefill,
        theme: { color: "#2563eb" },
        handler: async (result) => {
          setBuying(productCode);
          try {
            await verifyBillingPayment(result);
            await reload();
            setNotice("Payment verified. Your replies are ready to use.");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Payment was made but could not be verified yet. Refresh billing in a moment.");
          } finally { setBuying(""); }
        },
        modal: { ondismiss: () => setBuying("") },
      });
      checkout.on("payment.failed", (event) => {
        setError(event.error?.description || "Payment did not complete. You have not been charged for an unsuccessful payment.");
        setBuying("");
      });
      checkout.open();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start checkout.");
      setBuying("");
    }
  }

  const ownOrders = billing?.orders ?? [];
  return <div className="mx-auto w-full max-w-5xl space-y-7 pb-8">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">Plans & usage</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">Replies for your AI workspace</h1><p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-300">One free AI reply is included. Choose reply credits or a plan whenever you need more.</p></div>
      <button type="button" onClick={() => { setLoading(true); void reload().catch((cause) => setError(cause instanceof Error ? cause.message : "Refresh failed.")).finally(() => setLoading(false)); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw className="size-4" />Refresh</button>
    </header>

    {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</div>}
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">{notice}</div>}

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Current reply balance">
      <div className="surface rounded-2xl p-4"><p className="text-sm text-slate-500 dark:text-slate-400">Free replies left</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{loading ? "…" : billing?.is_owner ? "Unlimited" : billing?.free_replies_remaining ?? 0}</p></div>
      <div className="surface rounded-2xl p-4"><p className="text-sm text-slate-500 dark:text-slate-400">Purchased replies</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{loading ? "…" : billing?.is_owner ? "Unlimited" : billing?.token_balance ?? 0}</p></div>
      <div className="surface rounded-2xl p-4"><p className="text-sm text-slate-500 dark:text-slate-400">Plan replies this period</p><p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{loading ? "…" : billing?.is_owner ? "Unlimited" : billing?.subscription_replies_remaining ?? 0}</p></div>
      <div className="surface rounded-2xl p-4"><p className="text-sm text-slate-500 dark:text-slate-400">Plan status</p><p className="mt-2 text-lg font-bold text-slate-950 dark:text-white">{billing?.is_owner ? "Owner access" : billing?.subscription_active ? "Active" : "No active plan"}</p>{billing?.subscription_expires_at && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Until {new Date(billing.subscription_expires_at).toLocaleDateString()}</p>}</div>
    </section>

    {billing?.is_owner && <p className="flex items-start gap-2 rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><ShieldCheck className="mt-0.5 size-4 shrink-0" />Owner billing is exempt from reply limits. Payment records below include each buyer’s name, email, product, amount, and gateway IDs.</p>}
    {isGuest && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Purchases require an account so your reply balance remains attached to you. <a className="ml-1 font-semibold underline" href="/account">Sign in or create an account</a>.</div>}

    <section>
      <div className="mb-4 flex items-center gap-2"><Sparkles className="size-5 text-blue-600 dark:text-blue-300" /><h2 className="text-xl font-bold text-slate-950 dark:text-white">Choose an option</h2></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => <article key={product.code} className="surface relative flex flex-col rounded-2xl p-5">
          {product.badge && <span className="absolute right-4 top-4 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">{product.badge}</span>}
          <h3 className="pr-24 text-lg font-bold text-slate-950 dark:text-white">{product.title}</h3><p className="mt-1 min-h-10 text-sm text-slate-600 dark:text-slate-300">{product.detail}</p>
          <p className="mt-4 text-3xl font-bold text-slate-950 dark:text-white">{product.price}<span className="ml-1 text-sm font-medium text-slate-500">INR</span></p>
          <button type="button" onClick={() => void purchase(product.code)} disabled={Boolean(buying) || isGuest || !billing || !billing.razorpay_key_id || billing.is_owner} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><CreditCard className="size-4" />{buying === product.code ? "Opening checkout…" : "Continue to secure checkout"}</button>
          {!billing?.razorpay_key_id && !loading && <p className="mt-2 text-center text-xs text-slate-500">Online checkout is not configured on the server yet.</p>}
        </article>)}
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><Check className="size-4 text-emerald-600" />Checkout runs through Razorpay. Credits appear only after the server confirms a captured payment.</p>
    </section>

    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-slate-200 p-5 dark:border-slate-800"><h2 className="text-lg font-bold text-slate-950 dark:text-white">{billing?.is_owner ? "All customer payments" : "Your payment history"}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{billing?.is_owner ? "Latest 500 gateway orders, including buyer names and emails." : "Your latest checkout orders and payment status."}</p></div>
      {(billing?.is_owner ? ownerOrders : ownOrders).length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-white/5 dark:text-slate-400"><tr><th className="px-5 py-3">Buyer</th><th className="px-5 py-3">Product</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Date / payment ID</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{(billing?.is_owner ? ownerOrders : ownOrders).map((order) => <tr key={order.id}><td className="px-5 py-3"><p className="font-semibold text-slate-900 dark:text-white">{order.buyer_name}</p><p className="text-xs text-slate-500">{order.buyer_email}</p></td><td className="px-5 py-3 text-slate-700 dark:text-slate-200">{order.product_name}</td><td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">₹{order.amount_inr}</td><td className="px-5 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${order.status === "paid" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>{order.status}</span></td><td className="px-5 py-3 text-xs text-slate-500">{new Date(order.paid_at || order.created_at).toLocaleString()}<br />{order.gateway_payment_id || order.gateway_order_id}</td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-slate-500 dark:text-slate-400">No payment records yet.</p>}
    </section>
  </div>;
}
