import {
  calculateInvestment,
  calculateSavingsPlan,
  calculateTotals,
  generateFixedTransactions
} from "./finance.js";

export function calculateSafetyNet(monthlyRequiredExpenses, safetyMonths) {
  return Math.max(monthlyRequiredExpenses, 0) * Math.max(Number(safetyMonths) || 0, 0);
}

export function estimateMonthlyVariableCashflow(transactions, options = {}) {
  const months = groupPastTransactionsByMonth(transactions);
  const monthCount = Math.max(months.size, 1);
  let variableExpenses = 0;
  let variableIncome = 0;

  for (const totals of months.values()) {
    variableExpenses += totals.expense;
    variableIncome += totals.income;
  }

  const expenseBuffer = Math.max(Number(options.variableExpenseBuffer) || 0, 0) / 100;
  return {
    monthlyVariableExpenses: (variableExpenses / monthCount) * (1 + expenseBuffer),
    monthlyVariableIncome: options.includeVariableIncome ? variableIncome / monthCount : 0
  };
}

export function projectMonthlyCashflow(data, options) {
  const months = [];
  let runningCash = Number(options.availableCash) || 0;
  const projectionMonths = Math.max(Number(options.projectionMonths) || 1, 1);
  const today = new Date(`${options.startDate}T00:00:00`);
  const variableEstimate = estimateMonthlyVariableCashflow(data.transactions, options);

  for (let index = 0; index < projectionMonths; index += 1) {
    const monthStart = new Date(today.getFullYear(), today.getMonth() + index, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + index + 1, 0);
    const range = { start: toIso(monthStart), end: toIso(monthEnd) };
    const fixedTransactions = generateFixedTransactions(data.fixedItems, range);
    const fixedTotals = calculateTotals(fixedTransactions, range);
    const investmentMaturities = investmentsMaturingInRange(data.investments, range);
    const goalSavings = data.goals.reduce((total, goal) => {
      return total + calculateSavingsPlan(goal, "monthly").amount;
    }, 0);
    const income = fixedTotals.income + variableEstimate.monthlyVariableIncome + investmentMaturities.total;
    const expenses = fixedTotals.expense + variableEstimate.monthlyVariableExpenses + goalSavings;

    runningCash += income - expenses;
    months.push({
      label: monthStart.toLocaleDateString("es-EC", { month: "long", year: "numeric" }),
      start: range.start,
      end: range.end,
      income,
      expenses,
      investmentMaturities: investmentMaturities.total,
      goalSavings,
      projectedCash: runningCash
    });
  }

  return months;
}

export function calculateInvestmentCapacity(data, options) {
  const projections = projectMonthlyCashflow(data, options);
  const requiredExpenses = estimateRequiredMonthlyExpenses(data, options);
  const safetyNet = calculateSafetyNet(requiredExpenses, options.safetyMonths);
  const tightestMonth = projections.reduce((tightest, month) => {
    return !tightest || month.projectedCash < tightest.projectedCash ? month : tightest;
  }, null);
  const capacity = Math.max((tightestMonth?.projectedCash || 0) - safetyNet, 0);

  return {
    capacity,
    safetyNet,
    tightestMonth,
    projections,
    requiredExpenses
  };
}

function estimateRequiredMonthlyExpenses(data, options) {
  const start = new Date(`${options.startDate}T00:00:00`);
  const range = {
    start: toIso(new Date(start.getFullYear(), start.getMonth(), 1)),
    end: toIso(new Date(start.getFullYear(), start.getMonth() + 1, 0))
  };
  const fixedTotals = calculateTotals(generateFixedTransactions(data.fixedItems, range), range);
  const variableEstimate = estimateMonthlyVariableCashflow(data.transactions, options);
  return fixedTotals.expense + variableEstimate.monthlyVariableExpenses;
}

function investmentsMaturingInRange(investments, range) {
  return investments
    .filter((investment) => investment.endDate >= range.start && investment.endDate <= range.end)
    .reduce(
      (summary, investment) => {
        summary.total += calculateInvestment(investment, range.start).finalAmount;
        return summary;
      },
      { total: 0 }
    );
}

function groupPastTransactionsByMonth(transactions) {
  return transactions
    .filter((transaction) => transaction.category !== "fixed")
    .reduce((months, transaction) => {
      const key = transaction.date.slice(0, 7);
      const totals = months.get(key) || { income: 0, expense: 0 };
      totals[transaction.kind] += Number(transaction.amount) || 0;
      months.set(key, totals);
      return months;
    }, new Map());
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}
