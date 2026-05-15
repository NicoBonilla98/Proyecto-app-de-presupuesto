export const incomeCategories = [
  { value: "salary", label: "Salario" },
  { value: "business", label: "Negocio" },
  { value: "freelance", label: "Freelance" },
  { value: "bonus", label: "Bonos" },
  { value: "investment", label: "Inversiones" },
  { value: "rent", label: "Arriendos" },
  { value: "sales", label: "Ventas" },
  { value: "gift", label: "Regalos" },
  { value: "refund", label: "Reembolsos" },
  { value: "other", label: "Otros" }
];

export const expenseCategories = [
  { value: "food", label: "Comida" },
  { value: "housing", label: "Vivienda" },
  { value: "transport", label: "Transporte" },
  { value: "health", label: "Salud" },
  { value: "leisure", label: "Ocio" },
  { value: "education", label: "Educacion" },
  { value: "services", label: "Servicios" },
  { value: "debts", label: "Deudas" },
  { value: "shopping", label: "Compras" },
  { value: "emergency", label: "Emergencias" },
  { value: "other", label: "Otros" }
];

export const householdMembers = [
  { value: "dad", label: "Papa" },
  { value: "mom", label: "Mama" },
  { value: "child", label: "Hijo" },
  { value: "home", label: "Casa" }
];

export const investmentProducts = [
  { value: "policy", label: "Poliza" },
  { value: "programmed_savings", label: "Cuenta de ahorro programado" },
  { value: "flexible_savings", label: "Cuenta de ahorro flexible" }
];

export function currency(value) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD"
  }).format(Number(value) || 0);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function getPeriodRange(dateInput, period) {
  const date = new Date(`${dateInput}T00:00:00`);
  const start = new Date(date);
  const end = new Date(date);

  if (period === "weekly") {
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    start.setDate(date.getDate() + offset);
    end.setDate(start.getDate() + 6);
  } else if (period === "biweekly") {
    start.setDate(date.getDate() <= 15 ? 1 : 16);
    end.setDate(date.getDate() <= 15 ? 15 : lastDayOfMonth(date));
  } else {
    start.setDate(1);
    end.setDate(lastDayOfMonth(date));
  }

  return {
    start: toIso(start),
    end: toIso(end)
  };
}

export function isWithinRange(date, range) {
  return date >= range.start && date <= range.end;
}

export function calculateTotals(transactions, range) {
  return transactions
    .filter((transaction) => isWithinRange(transaction.date, range))
    .reduce(
      (totals, transaction) => {
        if (transaction.kind === "income") {
          totals.income += transaction.amount;
        } else {
          totals.expense += transaction.amount;
        }
        totals.balance = totals.income - totals.expense;
        return totals;
      },
      { income: 0, expense: 0, balance: 0 }
    );
}

export function summarizeTransactionsByCategory(transactions, range, kind, categoryKey, categories) {
  const totals = new Map(categories.map((category) => [category.value, 0]));

  for (const transaction of transactions) {
    if (transaction.kind !== kind || !isWithinRange(transaction.date, range)) continue;
    const category = transaction[categoryKey] || "other";
    totals.set(category, (totals.get(category) || 0) + (Number(transaction.amount) || 0));
  }

  return [...totals.entries()]
    .map(([value, amount]) => ({
      value,
      amount,
      label: categories.find((category) => category.value === value)?.label || "Sin categoria"
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function calculateBudgetProgress(totals, range, currentDate = todayIso()) {
  const income = Number(totals.income) || 0;
  const expense = Number(totals.expense) || 0;
  const remaining = income - expense;
  const isOverBudget = remaining < 0;
  const usagePercent = income > 0 ? (expense / income) * 100 : expense > 0 ? 100 : 0;
  const cappedUsagePercent = Math.min(Math.max(usagePercent, 0), 100);
  const today = new Date(`${currentDate}T00:00:00`);
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const remainingBaseDate = today < start ? start : today;
  const daysRemaining = today > end ? 0 : Math.max(daysBetween(remainingBaseDate, end) + 1, 0);
  const dailyAvailable = daysRemaining > 0 ? Math.max(remaining, 0) / daysRemaining : Math.max(remaining, 0);

  return {
    income,
    expense,
    remaining,
    usagePercent,
    cappedUsagePercent,
    daysRemaining,
    dailyAvailable,
    isOverBudget,
    statusText:
      isOverBudget
        ? "Gastos superados para el periodo."
        : income <= 0
          ? "Registra ingresos para calcular tu presupuesto."
          : "En buen camino."
  };
}

export function generateFixedTransactions(fixedItems, range) {
  return fixedItems.flatMap((item) => {
    const start = item.startDate > range.start ? item.startDate : range.start;
    const end = item.endDate && item.endDate < range.end ? item.endDate : range.end;

    if (end < start) return [];

    return recurringDates(item.startDate, start, end, item.frequency).map((date) => ({
      id: `${item.id}:${date}`,
      fixedItemId: item.id,
      fixedSource: true,
      kind: item.kind,
      category: "fixed",
      description: item.description,
      amount: Number(item.amount) || 0,
      householdMember: item.householdMember || "home",
      incomeCategory: item.kind === "income" ? item.incomeCategory || "other" : undefined,
      expenseCategory: item.kind === "expense" ? item.expenseCategory || "other" : undefined,
      date
    }));
  });
}

export function calculateSavingsPlan(goal, cadence = "monthly") {
  const target = Number(goal.target) || 0;
  const saved = Number(goal.saved) || 0;
  const remaining = Math.max(target - saved, 0);
  const start = new Date(`${goal.startDate}T00:00:00`);
  const end = new Date(`${goal.targetDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return { remaining, periods: 1, amount: remaining };
  }

  const periods = cadence === "weekly" ? weeksBetween(start, end) : monthsBetween(start, end);
  return {
    remaining,
    periods,
    amount: periods > 0 ? remaining / periods : remaining
  };
}

export function createSavingCalendar(goal) {
  const plan = calculateSavingsPlan(goal, "monthly");
  const rows = [];
  const start = new Date(`${goal.startDate}T00:00:00`);

  for (let index = 0; index < plan.periods; index += 1) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + index);
    rows.push({
      label: date.toLocaleDateString("es-EC", { month: "long", year: "numeric" }),
      amount: plan.amount
    });
  }

  return rows;
}

export function calculateInvestment(investment, currentDate = todayIso()) {
  const productType = investment.productType || "policy";
  const principal = Number(investment.principal) || 0;
  const rate = (Number(investment.rate) || 0) / 100;
  const monthlyContribution = Number(investment.monthlyContribution) || 0;
  const start = new Date(`${investment.startDate}T00:00:00`);
  const end = new Date(`${investment.endDate}T00:00:00`);
  const now = new Date(`${currentDate}T00:00:00`);

  if (principal <= 0 || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return emptyInvestmentResult(principal);
  }

  const days = Math.max(daysBetween(start, end), 0);
  const years = days / 365;
  const annualRate = investment.ratePeriod === "monthly" ? rate * 12 : rate;
  const monthlyRate = investment.ratePeriod === "monthly" ? rate : rate / 12;
  const months = Math.max(monthsBetween(start, end), 1);
  const dailyRate = annualRate / 365;
  const extraContributions = normalizeExtraContributions(investment.extraContributions, start, end);
  const productResult = calculateInvestmentByProduct({
    productType,
    principal,
    annualRate,
    monthlyRate,
    dailyRate,
    years,
    days,
    months,
    monthlyContribution,
    extraContributions,
    start,
    end
  });
  const calculatedInterest = Math.max(productResult.finalAmount - principal - productResult.totalContributions, 0);
  const expectedInterest = Number(investment.expectedInterest);
  const hasExpectedInterest =
    investment.expectedInterest !== undefined &&
    investment.expectedInterest !== "" &&
    investment.expectedInterestManual !== false &&
    Number.isFinite(expectedInterest) &&
    expectedInterest >= 0;
  const interest = hasExpectedInterest ? expectedInterest : calculatedInterest;

  return {
    productType,
    principal,
    annualRate,
    monthlyRate,
    days,
    months,
    monthlyContribution,
    totalMonthlyContributions: productResult.totalMonthlyContributions,
    totalExtraContributions: productResult.totalExtraContributions,
    totalContributions: productResult.totalContributions,
    finalAmount: principal + productResult.totalContributions + interest,
    interest,
    calculatedInterest,
    calculationLabel: productResult.calculationLabel,
    status: investmentStatus(start, end, now),
    daysRemaining: Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
  };
}

export function summarizeInvestments(investments, currentDate = todayIso()) {
  const summary = investments.reduce(
    (totals, investment) => {
      const result = calculateInvestment(investment, currentDate);
      totals.principal += result.principal;
      totals.finalAmount += result.finalAmount;
      totals.interest += result.interest;
      return totals;
    },
    { principal: 0, finalAmount: 0, interest: 0 }
  );
  const nextDue = investments
    .filter((investment) => investment.endDate >= currentDate)
    .sort((a, b) => a.endDate.localeCompare(b.endDate))[0];

  return { ...summary, nextDue };
}

export function investmentNeedsRenewalAlert(investment, currentDate = todayIso(), alertDays = 7) {
  const result = calculateInvestment(investment, currentDate);
  return result.productType === "policy" && result.status === "active" && result.daysRemaining >= 0 && result.daysRemaining <= alertDays;
}

export function validateDateWindow(startDate, endDate, minimumDays = 15) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, message: "Ingresa fechas validas." };
  }

  if (end <= start) {
    return { valid: false, message: "La fecha de fin debe ser posterior a la fecha de inicio." };
  }

  const days = daysBetween(start, end);
  if (days < minimumDays) {
    return { valid: false, message: `La fecha de fin debe estar al menos a ${minimumDays} dias de la fecha de inicio.` };
  }

  return { valid: true, message: "", days };
}

function monthsBetween(start, end) {
  const years = end.getFullYear() - start.getFullYear();
  const months = years * 12 + (end.getMonth() - start.getMonth());
  return Math.max(months + 1, 1);
}

function weeksBetween(start, end) {
  const milliseconds = end.getTime() - start.getTime();
  return Math.max(Math.ceil(milliseconds / (7 * 24 * 60 * 60 * 1000)), 1);
}

function recurringDates(seedDate, startDate, endDate, frequency) {
  const dates = [];
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  let cursor = new Date(`${seedDate}T00:00:00`);

  if (frequency === "monthly") {
    while (toIso(cursor) < startDate) {
      cursor.setMonth(cursor.getMonth() + 1);
    }
    while (cursor <= end) {
      dates.push(toIso(cursor));
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return dates;
  }

  while (cursor < start) {
    cursor.setDate(cursor.getDate() + 7);
  }
  while (cursor <= end) {
    dates.push(toIso(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function daysBetween(start, end) {
  return Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function calculateInvestmentByProduct(input) {
  if (input.productType === "programmed_savings") {
    return calculateProgrammedSavings(input);
  }

  if (input.productType === "flexible_savings") {
    return {
      finalAmount: input.principal * (1 + input.dailyRate) ** input.days,
      totalMonthlyContributions: 0,
      totalExtraContributions: 0,
      totalContributions: 0,
      calculationLabel: "Ahorro flexible con interes compuesto diario"
    };
  }

  return {
    finalAmount: input.principal * (1 + input.annualRate * input.years),
    totalMonthlyContributions: 0,
    totalExtraContributions: 0,
    totalContributions: 0,
    calculationLabel: "Poliza con interes fijo por la duracion"
  };
}

function calculateProgrammedSavings(input) {
  let balance = input.principal;
  let totalMonthlyContributions = 0;
  let totalExtraContributions = 0;
  const monthlyContributionDates = new Set(recurringMonthlyDates(input.start, input.end, input.months));
  const extraContributionMap = groupExtraContributions(input.extraContributions);
  const cursor = new Date(input.start);

  while (cursor <= input.end) {
    const date = toIso(cursor);
    const extraContribution = extraContributionMap.get(date) || 0;

    if (monthlyContributionDates.has(date)) {
      balance += input.monthlyContribution;
      totalMonthlyContributions += input.monthlyContribution;
    }

    if (extraContribution > 0) {
      balance += extraContribution;
      totalExtraContributions += extraContribution;
    }

    if (cursor < input.end) {
      balance *= 1 + input.dailyRate;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    finalAmount: balance,
    totalMonthlyContributions,
    totalExtraContributions,
    totalContributions: totalMonthlyContributions + totalExtraContributions,
    calculationLabel: "Ahorro programado con interes diario y aportes fechados"
  };
}

function recurringMonthlyDates(start, end, months) {
  const dates = [];

  for (let month = 0; month < months; month += 1) {
    const date = new Date(start);
    date.setMonth(start.getMonth() + month);
    if (date <= end) {
      dates.push(toIso(date));
    }
  }

  return dates;
}

function groupExtraContributions(extraContributions) {
  return extraContributions.reduce((map, contribution) => {
    map.set(contribution.date, (map.get(contribution.date) || 0) + contribution.amount);
    return map;
  }, new Map());
}

function normalizeExtraContributions(extraContributions = [], start, end) {
  if (!Array.isArray(extraContributions)) return [];

  return extraContributions
    .map((contribution) => ({
      date: contribution.date,
      amount: Number(contribution.amount) || 0,
      note: contribution.note || ""
    }))
    .filter((contribution) => {
      const date = new Date(`${contribution.date}T00:00:00`);
      return contribution.amount > 0 && !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });
}

function investmentStatus(start, end, now) {
  if (now < start) return "upcoming";
  if (now > end) return "finished";
  return "active";
}

function emptyInvestmentResult(principal) {
  return {
    principal,
    annualRate: 0,
    monthlyRate: 0,
    days: 0,
    months: 1,
    finalAmount: principal,
    interest: 0,
    calculatedInterest: 0,
    totalMonthlyContributions: 0,
    totalExtraContributions: 0,
    totalContributions: 0,
    status: "active",
    daysRemaining: 0
  };
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}
