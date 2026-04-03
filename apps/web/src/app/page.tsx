import { serverApi } from "@/lib/trpc-server";
import { formatCurrency } from "@pitwall/shared";

export default async function DashboardPage() {
  const overview = await serverApi.dashboard.overview();

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Monthly Burn</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(overview.monthlyBurn)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            {overview.monthlyTransactions} transactions
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">AI Costs (MTD)</p>
          <p className="text-3xl font-bold mt-1">
            {formatCurrency(overview.aiCostsMtd)}
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <p className="text-sm text-zinc-400">Portfolio</p>
          <p className="text-3xl font-bold mt-1">
            {overview.portfolio
              ? formatCurrency(overview.portfolio.netLiquidation)
              : "Not connected"}
          </p>
          {overview.portfolio && (
            <p className="text-xs text-zinc-500 mt-1">
              as of {overview.portfolio.date}
            </p>
          )}
        </div>
      </div>

      {/* Spending by Domain */}
      {overview.domainBreakdown.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Spending by Domain (This Month)
          </h3>
          <div className="space-y-3">
            {overview.domainBreakdown.map((item) => (
              <div
                key={item.domain ?? "uncategorized"}
                className="flex justify-between items-center"
              >
                <span className="text-sm text-zinc-400 capitalize">
                  {item.domain ?? "Uncategorized"}
                </span>
                <span className="font-mono">
                  {formatCurrency(item.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Expenses</h3>
        {overview.recentExpenses.length === 0 ? (
          <p className="text-zinc-500 text-sm">
            No expenses yet. Add your first expense to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {overview.recentExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0"
              >
                <div>
                  <p className="text-sm">{expense.description}</p>
                  <p className="text-xs text-zinc-500">
                    {expense.date} &middot;{" "}
                    {expense.category?.name ?? "Uncategorized"}
                  </p>
                </div>
                <span className="font-mono text-red-400">
                  -{formatCurrency(expense.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
