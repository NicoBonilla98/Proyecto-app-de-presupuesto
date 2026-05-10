export const incomeCategories = [
  { value: "fixed", label: "Ganancia fija" },
  { value: "variable", label: "Ganancia variable" },
  { value: "unique", label: "Ingreso unico" },
  { value: "other", label: "Ingreso vario" }
];

export const expenseCategories = [
  { value: "fixed", label: "Gasto fijo" },
  { value: "variable", label: "Gasto variable" },
  { value: "unique", label: "Gasto unico" },
  { value: "emergency", label: "Gasto emergente" }
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
  const productResult = calculateInvestmentByProduct({
    productType,
    principal,
    annualRate,
    monthlyRate,
    dailyRate,
    years,
    days,
    months,
    monthlyContribution
  });
  const calculatedInterest = Math.max(productResult.finalAmount - principal - productResult.totalContributions, 0);
  const expectedInterest = Number(investment.expectedInterest);
  const hasExpectedInterest =
    investment.expectedInterest !== undefined &&
    investment.expectedInterest !== "" &&
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
    let balance = input.principal;
    let totalContributions = 0;

    for (let month = 0; month < input.months; month += 1) {
      balance = balance * (1 + input.monthlyRate) + input.monthlyContribution;
      totalContributions += input.monthlyContribution;
    }

    return {
      finalAmount: balance,
      totalContributions,
      calculationLabel: "Ahorro programado con interes compuesto mensual"
    };
  }

  if (input.productType === "flexible_savings") {
    return {
      finalAmount: input.principal * (1 + input.dailyRate) ** input.days,
      totalContributions: 0,
      calculationLabel: "Ahorro flexible con interes compuesto diario"
    };
  }

  return {
    finalAmount: input.principal * (1 + input.annualRate * input.years),
    totalContributions: 0,
    calculationLabel: "Poliza con interes fijo por la duracion"
  };
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
