import {
  calculateBudgetProgress,
  calculateInvestment,
  calculateSavingsPlan,
  calculateTotals,
  createSavingCalendar,
  currency,
  expenseCategories,
  generateFixedTransactions,
  getPeriodRange,
  incomeCategories,
  investmentNeedsRenewalAlert,
  investmentProducts,
  summarizeInvestments,
  todayIso,
  validateDateWindow
} from "./finance.js";
import { createId } from "./ids.js";
import { calculateInvestmentCapacity } from "./liquidity.js";
import { hasAllSharedRecords, hasStoredRecords, mergeStateCopies, stateFingerprint } from "./state-sync.js";

const storageKey = "presupuesto-hogar:v1";
let hasSavedLocalState = Boolean(localStorage.getItem(storageKey));
const syncRetryDelay = 5000;
const syncRefreshDelay = 15000;
let isSavingServerState = false;
let pendingServerSave = false;
let syncRetryTimer = null;
let lastSyncedFingerprint = "";
let investmentInterestEdited = false;
let currentExtraContributions = [];
const state = loadState();
const calendarState = {
  year: new Date().getFullYear(),
  month: new Date().getMonth()
};

const elements = {
  tabButtons: document.querySelectorAll("[data-tab-target]"),
  tabPanels: document.querySelectorAll(".tab-panel"),
  syncStatus: document.querySelector("#syncStatus"),
  periodSelect: document.querySelector("#periodSelect"),
  incomeTotal: document.querySelector("#incomeTotal"),
  expenseTotal: document.querySelector("#expenseTotal"),
  balanceTotal: document.querySelector("#balanceTotal"),
  savingSuggestion: document.querySelector("#savingSuggestion"),
  incomeForm: document.querySelector("#incomeForm"),
  incomeEditId: document.querySelector("#incomeEditId"),
  incomeEditMode: document.querySelector("#incomeEditMode"),
  incomeType: document.querySelector("#incomeType"),
  incomeDescription: document.querySelector("#incomeDescription"),
  incomeAmount: document.querySelector("#incomeAmount"),
  incomeDateField: document.querySelector("#incomeDateField"),
  incomeDate: document.querySelector("#incomeDate"),
  incomeFixedFields: document.querySelector("#incomeFixedFields"),
  incomeFrequency: document.querySelector("#incomeFrequency"),
  incomeStartDate: document.querySelector("#incomeStartDate"),
  cancelIncomeEdit: document.querySelector("#cancelIncomeEdit"),
  incomePeriodLabel: document.querySelector("#incomePeriodLabel"),
  incomePeriodList: document.querySelector("#incomePeriodList"),
  expenseForm: document.querySelector("#expenseForm"),
  expenseEditId: document.querySelector("#expenseEditId"),
  expenseEditMode: document.querySelector("#expenseEditMode"),
  expenseType: document.querySelector("#expenseType"),
  expenseCategory: document.querySelector("#expenseCategory"),
  expenseDescription: document.querySelector("#expenseDescription"),
  expenseAmount: document.querySelector("#expenseAmount"),
  expenseDateField: document.querySelector("#expenseDateField"),
  expenseDate: document.querySelector("#expenseDate"),
  expenseFixedFields: document.querySelector("#expenseFixedFields"),
  expenseFrequency: document.querySelector("#expenseFrequency"),
  expenseStartDate: document.querySelector("#expenseStartDate"),
  cancelExpenseEdit: document.querySelector("#cancelExpenseEdit"),
  expensePeriodLabel: document.querySelector("#expensePeriodLabel"),
  expensePeriodList: document.querySelector("#expensePeriodList"),
  budgetHealthBox: document.querySelector("#budgetHealthBox"),
  budgetHealthTitle: document.querySelector("#budgetHealthTitle"),
  budgetHealthAmount: document.querySelector("#budgetHealthAmount"),
  budgetProgressCard: document.querySelector("#budgetProgressCard"),
  budgetSpentAmount: document.querySelector("#budgetSpentAmount"),
  budgetSpentCaption: document.querySelector("#budgetSpentCaption"),
  budgetUsageBar: document.querySelector("#budgetUsageBar"),
  budgetUsagePercent: document.querySelector("#budgetUsagePercent"),
  budgetRemainingCard: document.querySelector("#budgetRemainingCard"),
  budgetRemainingAmount: document.querySelector("#budgetRemainingAmount"),
  budgetRemainingStatus: document.querySelector("#budgetRemainingStatus"),
  budgetDaysRemaining: document.querySelector("#budgetDaysRemaining"),
  dailyBudgetCard: document.querySelector("#dailyBudgetCard"),
  dailyBudgetAmount: document.querySelector("#dailyBudgetAmount"),
  liquidityForm: document.querySelector("#liquidityForm"),
  availableCash: document.querySelector("#availableCash"),
  projectionMonths: document.querySelector("#projectionMonths"),
  safetyMonths: document.querySelector("#safetyMonths"),
  variableExpenseBuffer: document.querySelector("#variableExpenseBuffer"),
  includeVariableIncome: document.querySelector("#includeVariableIncome"),
  liquidityResult: document.querySelector("#liquidityResult"),
  liquidityStatus: document.querySelector("#liquidityStatus"),
  investmentCapacityAmount: document.querySelector("#investmentCapacityAmount"),
  safetyNetAmount: document.querySelector("#safetyNetAmount"),
  tightestMonthLabel: document.querySelector("#tightestMonthLabel"),
  requiredExpenseAmount: document.querySelector("#requiredExpenseAmount"),
  liquidityProjectionList: document.querySelector("#liquidityProjectionList"),
  goalForm: document.querySelector("#goalForm"),
  goalId: document.querySelector("#goalId"),
  goalName: document.querySelector("#goalName"),
  goalTarget: document.querySelector("#goalTarget"),
  goalSaved: document.querySelector("#goalSaved"),
  goalStartDate: document.querySelector("#goalStartDate"),
  goalTargetDate: document.querySelector("#goalTargetDate"),
  cancelGoalEdit: document.querySelector("#cancelGoalEdit"),
  goalList: document.querySelector("#goalList"),
  investmentPrincipalTotal: document.querySelector("#investmentPrincipalTotal"),
  investmentFinalTotal: document.querySelector("#investmentFinalTotal"),
  investmentInterestTotal: document.querySelector("#investmentInterestTotal"),
  nextInvestmentDue: document.querySelector("#nextInvestmentDue"),
  investmentAlerts: document.querySelector("#investmentAlerts"),
  investmentForm: document.querySelector("#investmentForm"),
  investmentId: document.querySelector("#investmentId"),
  investmentAlias: document.querySelector("#investmentAlias"),
  investmentBank: document.querySelector("#investmentBank"),
  investmentProductType: document.querySelector("#investmentProductType"),
  investmentPrincipal: document.querySelector("#investmentPrincipal"),
  investmentRate: document.querySelector("#investmentRate"),
  monthlyContributionField: document.querySelector("#monthlyContributionField"),
  investmentMonthlyContribution: document.querySelector("#investmentMonthlyContribution"),
  extraContributionSection: document.querySelector("#extraContributionSection"),
  extraContributionDate: document.querySelector("#extraContributionDate"),
  extraContributionAmount: document.querySelector("#extraContributionAmount"),
  extraContributionNote: document.querySelector("#extraContributionNote"),
  addExtraContribution: document.querySelector("#addExtraContribution"),
  extraContributionList: document.querySelector("#extraContributionList"),
  investmentRatePeriod: document.querySelector("#investmentRatePeriod"),
  investmentInterestType: document.querySelector("#investmentInterestType"),
  investmentStartDate: document.querySelector("#investmentStartDate"),
  investmentEndDate: document.querySelector("#investmentEndDate"),
  investmentExpectedInterest: document.querySelector("#investmentExpectedInterest"),
  investmentMonthFilter: document.querySelector("#investmentMonthFilter"),
  investmentNameFilter: document.querySelector("#investmentNameFilter"),
  investmentBankFilter: document.querySelector("#investmentBankFilter"),
  cancelInvestmentEdit: document.querySelector("#cancelInvestmentEdit"),
  investmentList: document.querySelector("#investmentList"),
  previousCalendarMonth: document.querySelector("#previousCalendarMonth"),
  nextCalendarMonth: document.querySelector("#nextCalendarMonth"),
  todayCalendarMonth: document.querySelector("#todayCalendarMonth"),
  calendarMonthSelect: document.querySelector("#calendarMonthSelect"),
  calendarYearInput: document.querySelector("#calendarYearInput"),
  calendarGrid: document.querySelector("#calendarGrid"),
  emptyStateTemplate: document.querySelector("#emptyStateTemplate")
};

elements.incomeDate.value = todayIso();
elements.incomeStartDate.value = todayIso();
elements.expenseDate.value = todayIso();
elements.expenseStartDate.value = todayIso();
elements.availableCash.value = state.liquiditySettings.availableCash || "";
elements.projectionMonths.value = state.liquiditySettings.projectionMonths;
elements.safetyMonths.value = state.liquiditySettings.safetyMonths;
elements.variableExpenseBuffer.value = state.liquiditySettings.variableExpenseBuffer;
elements.includeVariableIncome.checked = state.liquiditySettings.includeVariableIncome;
elements.goalStartDate.value = todayIso();
elements.goalTargetDate.value = todayIso();
elements.investmentStartDate.value = todayIso();
elements.investmentEndDate.value = todayIso();
elements.extraContributionDate.value = todayIso();
elements.periodSelect.value = state.period;

updateBudgetFormFields("income");
updateBudgetFormFields("expense");
updateInvestmentProductFields();
updateInvestmentExpectedInterest({ force: true });
render();
hydrateServerState();
setInterval(syncFromServer, syncRefreshDelay);
window.addEventListener("focus", syncFromServer);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncFromServer();
});

elements.tabButtons.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tabTarget));
});

elements.periodSelect.addEventListener("change", () => {
  state.period = elements.periodSelect.value;
  persist();
  render();
});

elements.incomeType.addEventListener("change", () => updateBudgetFormFields("income"));
elements.expenseType.addEventListener("change", () => updateBudgetFormFields("expense"));
elements.incomeForm.addEventListener("submit", (event) => handleBudgetSubmit(event, "income"));
elements.expenseForm.addEventListener("submit", (event) => handleBudgetSubmit(event, "expense"));
elements.cancelIncomeEdit.addEventListener("click", () => resetBudgetForm("income"));
elements.cancelExpenseEdit.addEventListener("click", () => resetBudgetForm("expense"));
elements.incomeStartDate.addEventListener("change", () => elements.incomeStartDate.setCustomValidity(""));
elements.expenseStartDate.addEventListener("change", () => elements.expenseStartDate.setCustomValidity(""));

elements.liquidityForm.addEventListener("submit", (event) => {
  event.preventDefault();
  updateLiquiditySettings();
  persist();
  renderLiquidityCapacity();
});

elements.goalForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const goal = {
    id: elements.goalId.value || createId(),
    name: elements.goalName.value.trim(),
    target: Number(elements.goalTarget.value),
    saved: Number(elements.goalSaved.value || 0),
    startDate: elements.goalStartDate.value,
    targetDate: elements.goalTargetDate.value
  };
  const dateValidation = validateDateWindow(goal.startDate, goal.targetDate);

  if (!goal.name || goal.target <= 0) return;
  if (!dateValidation.valid) {
    elements.goalTargetDate.setCustomValidity(dateValidation.message);
    elements.goalTargetDate.reportValidity();
    return;
  }
  elements.goalTargetDate.setCustomValidity("");

  upsert(state.goals, goal);
  resetGoalForm();
  persist();
  render();
});

elements.cancelGoalEdit.addEventListener("click", resetGoalForm);
elements.goalStartDate.addEventListener("change", clearGoalDateValidation);
elements.goalTargetDate.addEventListener("change", clearGoalDateValidation);

elements.investmentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const investment = {
    id: elements.investmentId.value || createId(),
    alias: elements.investmentAlias.value.trim(),
    bank: elements.investmentBank.value.trim(),
    productType: elements.investmentProductType.value,
    name: productLabel(elements.investmentProductType.value),
    principal: Number(elements.investmentPrincipal.value),
    rate: Number(elements.investmentRate.value),
    monthlyContribution: Number(elements.investmentMonthlyContribution.value || 0),
    extraContributions: elements.investmentProductType.value === "programmed_savings" ? currentExtraContributions : [],
    expectedInterest: Number(elements.investmentExpectedInterest.value || 0),
    expectedInterestManual: investmentInterestEdited,
    ratePeriod: elements.investmentRatePeriod.value,
    interestType: elements.investmentInterestType.value,
    startDate: elements.investmentStartDate.value,
    endDate: elements.investmentEndDate.value
  };
  const dateValidation = validateDateWindow(investment.startDate, investment.endDate);

  if (!investment.alias || !investment.bank || !investment.name || investment.principal <= 0) return;
  if (!Number.isFinite(investment.expectedInterest) || investment.expectedInterest < 0) {
    elements.investmentExpectedInterest.setCustomValidity("Ingresa un interes valido.");
    elements.investmentExpectedInterest.reportValidity();
    return;
  }
  elements.investmentExpectedInterest.setCustomValidity("");
  if (investment.productType === "programmed_savings" && investment.monthlyContribution <= 0) {
    elements.investmentMonthlyContribution.setCustomValidity("Ingresa el monto mensual que se abonara.");
    elements.investmentMonthlyContribution.reportValidity();
    return;
  }
  elements.investmentMonthlyContribution.setCustomValidity("");
  const invalidExtraContribution = investment.extraContributions.find(
    (contribution) => contribution.date < investment.startDate || contribution.date > investment.endDate
  );
  if (invalidExtraContribution) {
    elements.extraContributionDate.setCustomValidity("Revisa los aportes extraordinarios: deben estar dentro del plazo de la inversion.");
    elements.extraContributionDate.reportValidity();
    return;
  }
  elements.extraContributionDate.setCustomValidity("");
  if (!dateValidation.valid) {
    elements.investmentEndDate.setCustomValidity(dateValidation.message);
    elements.investmentEndDate.reportValidity();
    return;
  }
  elements.investmentEndDate.setCustomValidity("");

  upsert(state.investments, investment);
  resetInvestmentForm();
  persist();
  render();
});

elements.cancelInvestmentEdit.addEventListener("click", resetInvestmentForm);
elements.investmentStartDate.addEventListener("change", () => {
  clearInvestmentDateValidation();
  updateInvestmentExpectedInterest();
});
elements.investmentEndDate.addEventListener("change", () => {
  clearInvestmentDateValidation();
  updateInvestmentExpectedInterest();
});
elements.investmentProductType.addEventListener("change", () => {
  updateInvestmentProductFields();
  updateInvestmentExpectedInterest();
});
elements.addExtraContribution.addEventListener("click", addExtraContribution);
[
  elements.investmentPrincipal,
  elements.investmentRate,
  elements.investmentMonthlyContribution,
  elements.investmentRatePeriod,
  elements.investmentInterestType
].forEach((input) => {
  input.addEventListener("input", () => updateInvestmentExpectedInterest());
  input.addEventListener("change", () => updateInvestmentExpectedInterest());
});
elements.investmentExpectedInterest.addEventListener("input", () => {
  investmentInterestEdited = true;
  elements.investmentExpectedInterest.setCustomValidity("");
});
elements.investmentMonthFilter.addEventListener("input", renderInvestments);
elements.investmentNameFilter.addEventListener("input", renderInvestments);
elements.investmentBankFilter.addEventListener("input", renderInvestments);
elements.previousCalendarMonth.addEventListener("click", () => changeCalendarMonth(-1));
elements.nextCalendarMonth.addEventListener("click", () => changeCalendarMonth(1));
elements.todayCalendarMonth.addEventListener("click", goToCurrentCalendarMonth);
elements.calendarMonthSelect.addEventListener("change", updateCalendarFromControls);
elements.calendarYearInput.addEventListener("change", updateCalendarFromControls);

function activateTab(tabId) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tabTarget === tabId);
  });
  elements.tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
}

function render() {
  const range = getPeriodRange(todayIso(), state.period);
  const budgetTransactions = getBudgetTransactions(range);
  const totals = calculateTotals(budgetTransactions, range);
  const mainGoal = state.goals[0];
  const savingPlan = mainGoal ? calculateSavingsPlan(mainGoal, "monthly") : { amount: 0 };

  elements.incomeTotal.textContent = currency(totals.income);
  elements.expenseTotal.textContent = currency(totals.expense);
  elements.balanceTotal.textContent = currency(totals.balance);
  elements.savingSuggestion.textContent = currency(savingPlan.amount);
  elements.incomePeriodLabel.textContent = `${periodName(state.period)} actual: ${formatDate(range.start)} - ${formatDate(range.end)}.`;
  elements.expensePeriodLabel.textContent = `${periodName(state.period)} actual: ${formatDate(range.start)} - ${formatDate(range.end)}.`;

  renderBudgetPeriodLists(range, budgetTransactions);
  renderBudgetProgress(totals, range);
  renderBudgetHealth(totals);
  renderGoals();
  renderInvestments();
  renderCalendar();
  renderLiquidityCapacity();
}

function changeCalendarMonth(direction) {
  const date = new Date(calendarState.year, calendarState.month + direction, 1);
  calendarState.year = date.getFullYear();
  calendarState.month = date.getMonth();
  renderCalendar();
}

function goToCurrentCalendarMonth() {
  const today = new Date();
  calendarState.year = today.getFullYear();
  calendarState.month = today.getMonth();
  renderCalendar();
}

function updateCalendarFromControls() {
  const selectedYear = Number(elements.calendarYearInput.value);
  calendarState.month = Number(elements.calendarMonthSelect.value);
  calendarState.year = Number.isFinite(selectedYear) ? selectedYear : new Date().getFullYear();
  renderCalendar();
}

function handleBudgetSubmit(event, kind) {
  event.preventDefault();

  const type = elements[`${kind}Type`].value;
  const editId = elements[`${kind}EditId`].value;
  const editMode = elements[`${kind}EditMode`].value;
  const description = elements[`${kind}Description`].value.trim();
  const amount = Number(elements[`${kind}Amount`].value);

  if (!description || amount <= 0) return;

  if (type === "fixed") {
    const fixedItem = {
      id: editId || createId(),
      kind,
      frequency: elements[`${kind}Frequency`].value,
      description,
      amount,
      expenseCategory: kind === "expense" ? elements.expenseCategory.value : undefined,
      startDate: elements[`${kind}StartDate`].value
    };

    if (editMode === "fixed" && fixedItem.startDate < todayIso()) {
      elements[`${kind}StartDate`].setCustomValidity("La nueva version debe empezar desde hoy o una fecha futura.");
      elements[`${kind}StartDate`].reportValidity();
      return;
    }
    elements[`${kind}StartDate`].setCustomValidity("");

    if (editMode === "fixed") {
      versionFixedItem(fixedItem);
    } else {
      state.fixedItems.unshift(stampRecord(fixedItem));
    }
  } else {
    const transaction = {
      id: editMode === "transaction" && editId ? editId : createId(),
      kind,
      category: type,
      expenseCategory: kind === "expense" ? elements.expenseCategory.value : undefined,
      description,
      amount,
      date: elements[`${kind}Date`].value
    };
    upsert(state.transactions, transaction);
  }

  resetBudgetForm(kind);
  persist();
  render();
}

function updateBudgetFormFields(kind) {
  const isFixed = elements[`${kind}Type`].value === "fixed";
  elements[`${kind}FixedFields`].classList.toggle("is-hidden", !isFixed);
  elements[`${kind}DateField`].classList.toggle("is-hidden", isFixed);
  elements[`${kind}Date`].required = !isFixed;
  elements[`${kind}StartDate`].required = isFixed;
  elements[`${kind}StartDate`].setCustomValidity("");
}

function renderBudgetPeriodLists(range, budgetTransactions) {
  renderBudgetKindList("income", range, budgetTransactions);
  renderBudgetKindList("expense", range, budgetTransactions);
}

function renderBudgetKindList(kind, range, budgetTransactions) {
  const list = elements[`${kind}PeriodList`];
  const transactions = budgetTransactions
    .filter((transaction) => transaction.kind === kind && transaction.date >= range.start && transaction.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date));

  list.replaceChildren();

  if (transactions.length === 0) {
    list.append(emptyState());
    return;
  }

  for (const transaction of transactions) {
    const item = document.createElement("div");
    item.className = `list-item ${transaction.kind}`;
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(transaction.description)}</strong>
        <span>${categoryLabel(transaction)} · ${formatDate(transaction.date)}${transaction.fixedSource ? " · automatico" : ""}</span>
      </div>
      <div class="item-actions">
        <strong>${transaction.kind === "income" ? "+" : "-"}${currency(transaction.amount)}</strong>
        ${
          transaction.fixedSource
            ? `<button type="button" data-edit-fixed="${transaction.fixedItemId}">Editar</button>
               <button type="button" data-stop-fixed="${transaction.fixedItemId}">Eliminar futuro</button>`
            : `<button type="button" data-edit-transaction="${transaction.id}">Editar</button>
               <button type="button" data-delete-transaction="${transaction.id}">Eliminar</button>`
        }
      </div>
    `;
    list.append(item);
  }

  list.querySelectorAll("[data-edit-transaction]").forEach((button) => {
    button.addEventListener("click", () => editTransaction(button.dataset.editTransaction));
  });
  list.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => removeItem(state.transactions, button.dataset.deleteTransaction));
  });
  list.querySelectorAll("[data-edit-fixed]").forEach((button) => {
    button.addEventListener("click", () => editFixedItem(button.dataset.editFixed));
  });
  list.querySelectorAll("[data-stop-fixed]").forEach((button) => {
    button.addEventListener("click", () => stopFixedItem(button.dataset.stopFixed));
  });
}

function renderBudgetHealth(totals) {
  const savings = totals.income - totals.expense;
  const period = periodName(state.period).toLowerCase();
  const isOverBudget = savings < 0;

  elements.budgetHealthBox.classList.toggle("danger", isOverBudget);
  elements.budgetHealthBox.classList.toggle("success", !isOverBudget);
  elements.budgetHealthTitle.textContent = isOverBudget
    ? `Gastos superados para el ${period}.`
    : `Tus ahorros del ${period} son de:`;
  elements.budgetHealthAmount.textContent = currency(Math.abs(savings));
}

function renderBudgetProgress(totals, range) {
  const progress = calculateBudgetProgress(totals, range, todayIso());

  elements.budgetSpentAmount.textContent = currency(progress.expense);
  elements.budgetSpentCaption.textContent = `gastados de ${currency(progress.income)}`;
  elements.budgetUsageBar.style.width = `${progress.cappedUsagePercent}%`;
  elements.budgetUsagePercent.textContent = `${progress.usagePercent.toFixed(1)}% utilizado`;
  elements.budgetRemainingAmount.textContent = currency(progress.remaining);
  elements.budgetRemainingStatus.textContent = progress.statusText;
  elements.budgetDaysRemaining.textContent = progress.daysRemaining;
  elements.dailyBudgetAmount.textContent = currency(progress.dailyAvailable);

  elements.budgetProgressCard.classList.toggle("danger", progress.isOverBudget);
  elements.budgetRemainingCard.classList.toggle("danger", progress.isOverBudget);
  elements.dailyBudgetCard.classList.toggle("danger", progress.isOverBudget);
}

function updateLiquiditySettings() {
  state.liquiditySettings = {
    availableCash: Number(elements.availableCash.value || 0),
    projectionMonths: Number(elements.projectionMonths.value || 6),
    safetyMonths: Number(elements.safetyMonths.value || 2),
    variableExpenseBuffer: Number(elements.variableExpenseBuffer.value || 0),
    includeVariableIncome: elements.includeVariableIncome.checked
  };
}

function renderLiquidityCapacity() {
  updateLiquiditySettings();
  const result = calculateInvestmentCapacity(
    {
      transactions: state.transactions,
      fixedItems: state.fixedItems,
      goals: state.goals,
      investments: state.investments
    },
    {
      ...state.liquiditySettings,
      startDate: todayIso()
    }
  );
  const hasCapacity = result.capacity > 0;

  elements.liquidityResult.classList.toggle("success", hasCapacity);
  elements.liquidityResult.classList.toggle("danger", !hasCapacity);
  elements.liquidityStatus.textContent = hasCapacity
    ? "Puedes invertir este monto manteniendo la safety net."
    : "No recomendamos invertir dinero adicional ahora.";
  elements.investmentCapacityAmount.textContent = currency(result.capacity);
  elements.safetyNetAmount.textContent = currency(result.safetyNet);
  elements.tightestMonthLabel.textContent = result.tightestMonth?.label || "Sin datos";
  elements.requiredExpenseAmount.textContent = currency(result.requiredExpenses);
  renderLiquidityProjection(result.projections);
}

function renderLiquidityProjection(projections) {
  elements.liquidityProjectionList.replaceChildren();

  if (projections.length === 0) {
    elements.liquidityProjectionList.append(emptyState());
    return;
  }

  for (const month of projections) {
    const item = document.createElement("div");
    item.className = `projection-item${month.projectedCash < 0 ? " danger" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${month.label}</strong>
        <span>Ingresos ${currency(month.income)} · Gastos y metas ${currency(month.expenses)}</span>
      </div>
      <strong>${currency(month.projectedCash)}</strong>
    `;
    elements.liquidityProjectionList.append(item);
  }
}

function renderTransactions(range, budgetTransactions = getBudgetTransactions(range)) {
  const transactions = budgetTransactions
    .filter((transaction) => transaction.date >= range.start && transaction.date <= range.end)
    .sort((a, b) => b.date.localeCompare(a.date));

  elements.transactionList.replaceChildren();

  if (transactions.length === 0) {
    elements.transactionList.append(emptyState());
    return;
  }

  for (const transaction of transactions) {
    const item = document.createElement("div");
    item.className = `list-item ${transaction.kind}`;
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(transaction.description)}</strong>
        <span>${categoryLabel(transaction)} · ${formatDate(transaction.date)}${transaction.fixedSource ? " · automatico" : ""}</span>
      </div>
      <div class="item-actions">
        <strong>${transaction.kind === "income" ? "+" : "-"}${currency(transaction.amount)}</strong>
        ${
          transaction.fixedSource
            ? `<button type="button" data-edit-fixed="${transaction.fixedItemId}">Editar fijo</button>`
            : `<button type="button" data-edit-transaction="${transaction.id}">Editar</button>
               <button type="button" data-delete-transaction="${transaction.id}">Eliminar</button>`
        }
      </div>
    `;
    elements.transactionList.append(item);
  }

  elements.transactionList.querySelectorAll("[data-edit-transaction]").forEach((button) => {
    button.addEventListener("click", () => editTransaction(button.dataset.editTransaction));
  });

  elements.transactionList.querySelectorAll("[data-delete-transaction]").forEach((button) => {
    button.addEventListener("click", () => removeItem(state.transactions, button.dataset.deleteTransaction));
  });

  elements.transactionList.querySelectorAll("[data-edit-fixed]").forEach((button) => {
    button.addEventListener("click", () => editFixedItem(button.dataset.editFixed));
  });
}

function renderGoals() {
  elements.goalList.replaceChildren();

  if (state.goals.length === 0) {
    elements.goalList.append(emptyState());
    return;
  }

  for (const goal of state.goals) {
    const plan = calculateSavingsPlan(goal, "monthly");
    const calendar = createSavingCalendar(goal);
    const progress = Math.min(((goal.saved || 0) / goal.target) * 100, 100);
    const item = document.createElement("div");
    item.className = "goal-card";
    item.innerHTML = `
      <div class="goal-topline">
        <div>
          <strong>${escapeHtml(goal.name)}</strong>
          <span>Meta: ${currency(goal.target)} · Fecha: ${formatDate(goal.targetDate)}</span>
        </div>
        <div class="item-actions">
          <button type="button" data-edit-goal="${goal.id}">Editar</button>
          <button type="button" data-delete-goal="${goal.id}">Eliminar</button>
        </div>
      </div>
      <div class="progress-track" aria-label="Progreso de ahorro">
        <span style="width: ${progress}%"></span>
      </div>
      <p class="saving-result">Ahorra ${currency(plan.amount)} al mes durante ${plan.periods} mes(es).</p>
      <div class="calendar-grid">
        ${calendar
          .slice(0, 6)
          .map((row) => `<span><b>${row.label}</b>${currency(row.amount)}</span>`)
          .join("")}
      </div>
    `;
    elements.goalList.append(item);
  }

  elements.goalList.querySelectorAll("[data-edit-goal]").forEach((button) => {
    button.addEventListener("click", () => editGoal(button.dataset.editGoal));
  });

  elements.goalList.querySelectorAll("[data-delete-goal]").forEach((button) => {
    button.addEventListener("click", () => removeItem(state.goals, button.dataset.deleteGoal));
  });
}

function renderFixedItems() {
  const activeItems = state.fixedItems.filter((item) => !item.endDate || item.endDate >= todayIso());
  elements.fixedItemList.replaceChildren();

  if (activeItems.length === 0) {
    elements.fixedItemList.append(emptyState());
    return;
  }

  for (const item of activeItems) {
    const row = document.createElement("div");
    row.className = `list-item ${item.kind}`;
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(item.description)}</strong>
        <span>${item.kind === "income" ? "Ingreso fijo" : "Gasto fijo"} · ${frequencyLabel(item.frequency)} · desde ${formatDate(item.startDate)}</span>
      </div>
      <div class="item-actions">
        <strong>${item.kind === "income" ? "+" : "-"}${currency(item.amount)}</strong>
        <button type="button" data-edit-fixed="${item.id}">Editar</button>
        <button type="button" data-stop-fixed="${item.id}">Eliminar futuro</button>
      </div>
    `;
    elements.fixedItemList.append(row);
  }

  elements.fixedItemList.querySelectorAll("[data-edit-fixed]").forEach((button) => {
    button.addEventListener("click", () => editFixedItem(button.dataset.editFixed));
  });

  elements.fixedItemList.querySelectorAll("[data-stop-fixed]").forEach((button) => {
    button.addEventListener("click", () => stopFixedItem(button.dataset.stopFixed));
  });
}

function renderInvestments() {
  const summary = summarizeInvestments(state.investments);
  elements.investmentPrincipalTotal.textContent = currency(summary.principal);
  elements.investmentFinalTotal.textContent = currency(summary.finalAmount);
  elements.investmentInterestTotal.textContent = currency(summary.interest);
  elements.nextInvestmentDue.textContent = summary.nextDue ? formatDate(summary.nextDue.endDate) : "Sin datos";
  renderInvestmentAlerts();
  elements.investmentList.replaceChildren();

  if (state.investments.length === 0) {
    elements.investmentList.append(emptyState());
    return;
  }

  const investments = filterInvestments(state.investments).sort((a, b) => a.endDate.localeCompare(b.endDate));

  if (investments.length === 0) {
    elements.investmentList.append(emptyState("No hay inversiones con esos filtros."));
    return;
  }

  for (const investment of investments) {
    const result = calculateInvestment(investment);
    const item = document.createElement("div");
    const needsRenewal = investmentNeedsRenewalAlert(investment);
    item.className = `investment-card ${result.status}${needsRenewal ? " warning" : ""}`;
    item.innerHTML = `
      <div class="goal-topline">
        <div>
          <strong>${escapeHtml(investment.alias || investment.name)}</strong>
          <span>${escapeHtml(investment.bank)} · ${escapeHtml(productLabel(investment.productType))} · ${statusLabel(result.status)} · Vence: ${formatDate(investment.endDate)}</span>
        </div>
        <div class="item-actions">
          <button type="button" data-edit-investment="${investment.id}">Editar</button>
          <button type="button" data-delete-investment="${investment.id}">Eliminar</button>
        </div>
      </div>
      <dl class="investment-facts">
        <div><dt>Capital</dt><dd>${currency(result.principal)}</dd></div>
        <div><dt>Tasa anual</dt><dd>${formatPercent(result.annualRate)}</dd></div>
        <div><dt>Interes</dt><dd>${currency(result.interest)}</dd></div>
        <div><dt>Monto final</dt><dd>${currency(result.finalAmount)}</dd></div>
      </dl>
      ${
        result.totalContributions > 0
          ? `<p class="saving-result">Aporte mensual: ${currency(result.monthlyContribution)} · Aportes extra: ${currency(result.totalExtraContributions)} · Total aportado: ${currency(result.totalContributions)}</p>`
          : ""
      }
      ${
        needsRenewal
          ? `<p class="renewal-note">Renovar pronto: faltan ${result.daysRemaining} dia(s) para el vencimiento.</p>`
          : ""
      }
      <p class="saving-result">${result.calculationLabel} durante ${result.months} mes(es).</p>
    `;
    elements.investmentList.append(item);
  }

  elements.investmentList.querySelectorAll("[data-edit-investment]").forEach((button) => {
    button.addEventListener("click", () => editInvestment(button.dataset.editInvestment));
  });

  elements.investmentList.querySelectorAll("[data-delete-investment]").forEach((button) => {
    button.addEventListener("click", () => removeItem(state.investments, button.dataset.deleteInvestment));
  });
}

function filterInvestments(investments) {
  const month = elements.investmentMonthFilter.value;
  const name = normalizeSearch(elements.investmentNameFilter.value);
  const bank = normalizeSearch(elements.investmentBankFilter.value);

  return investments.filter((investment) => {
    const matchesMonth = !month || investment.endDate.startsWith(month);
    const matchesName =
      !name || normalizeSearch(`${investment.alias || ""} ${productLabel(investment.productType)}`).includes(name);
    const matchesBank = !bank || normalizeSearch(investment.bank || "").includes(bank);
    return matchesMonth && matchesName && matchesBank;
  });
}

function renderInvestmentAlerts() {
  const alerts = state.investments
    .filter((investment) => investmentNeedsRenewalAlert(investment))
    .sort((a, b) => a.endDate.localeCompare(b.endDate));

  elements.investmentAlerts.replaceChildren();

  for (const investment of alerts) {
    const result = calculateInvestment(investment);
    const item = document.createElement("article");
    item.className = "alert-card";
    item.innerHTML = `
      <div>
        <strong>Renovar poliza: ${escapeHtml(investment.alias || investment.name)}</strong>
        <span>${escapeHtml(investment.bank)} · vence el ${formatDate(investment.endDate)} · faltan ${result.daysRemaining} dia(s)</span>
      </div>
      <button type="button" data-alert-edit-investment="${investment.id}">Revisar</button>
    `;
    elements.investmentAlerts.append(item);
  }

  elements.investmentAlerts.querySelectorAll("[data-alert-edit-investment]").forEach((button) => {
    button.addEventListener("click", () => editInvestment(button.dataset.alertEditInvestment));
  });
}

function renderCalendar() {
  const monthStart = new Date(calendarState.year, calendarState.month, 1);
  const monthEnd = new Date(calendarState.year, calendarState.month + 1, 0);
  const startOffset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1;
  const totalCells = Math.ceil((startOffset + monthEnd.getDate()) / 7) * 7;
  const firstCell = new Date(calendarState.year, calendarState.month, 1 - startOffset);
  const eventsByDate = groupCalendarEvents();

  elements.calendarMonthSelect.value = String(calendarState.month);
  elements.calendarYearInput.value = String(calendarState.year);
  elements.calendarGrid.replaceChildren();

  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    const isoDate = toIsoDate(date);
    const dayEvents = eventsByDate.get(isoDate) || [];
    const cell = document.createElement("article");
    cell.className = `calendar-day${date.getMonth() === calendarState.month ? "" : " muted"}`;
    cell.innerHTML = `
      <strong>${date.getDate()}</strong>
      <div class="calendar-events">
        ${dayEvents.map(renderCalendarEvent).join("")}
      </div>
    `;
    elements.calendarGrid.append(cell);
  }
}

function groupCalendarEvents() {
  const calendarRange = getPeriodRange(`${calendarState.year}-${String(calendarState.month + 1).padStart(2, "0")}-01`, "monthly");
  const budgetTransactions = getBudgetTransactions(calendarRange);
  const events = [
    ...budgetTransactions.map((transaction) => ({
      date: transaction.date,
      type: transaction.kind,
      label: transaction.kind === "income" ? `Ingreso: ${transaction.description}` : `Gasto: ${transaction.description}`,
      amount: transaction.amount
    })),
    ...state.investments.map((investment) => ({
      date: investment.endDate,
      type: "policy",
      label: `Vence inversion: ${investment.alias || investment.name}`,
      amount: calculateInvestment(investment).finalAmount
    }))
  ];

  return events.reduce((grouped, event) => {
    const currentEvents = grouped.get(event.date) || [];
    currentEvents.push(event);
    grouped.set(event.date, currentEvents);
    return grouped;
  }, new Map());
}

function renderCalendarEvent(event) {
  return `<span class="calendar-event ${event.type}">${escapeHtml(event.label)} · ${currency(event.amount)}</span>`;
}

function renderCategoryOptions() {
  const categories = elements.transactionKind.value === "income" ? incomeCategories : expenseCategories;
  elements.transactionCategory.replaceChildren(
    ...categories.map((category) => {
      const option = document.createElement("option");
      option.value = category.value;
      option.textContent = category.label;
      return option;
    })
  );
}

function editTransaction(id) {
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  const kind = transaction.kind;
  activateTab("budgetTab");
  resetBudgetForm(kind);
  elements[`${kind}EditId`].value = transaction.id;
  elements[`${kind}EditMode`].value = "transaction";
  elements[`${kind}Type`].value = transaction.category === "variable" ? "variable" : "unique";
  if (kind === "expense") {
    elements.expenseCategory.value = transaction.expenseCategory || "other";
  }
  elements[`${kind}Description`].value = transaction.description;
  elements[`${kind}Amount`].value = transaction.amount;
  elements[`${kind}Date`].value = transaction.date;
  updateBudgetFormFields(kind);
  elements[`${kind}Description`].focus();
}

function editGoal(id) {
  const goal = state.goals.find((item) => item.id === id);
  if (!goal) return;

  activateTab("goalsTab");
  elements.goalId.value = goal.id;
  elements.goalName.value = goal.name;
  elements.goalTarget.value = goal.target;
  elements.goalSaved.value = goal.saved;
  elements.goalStartDate.value = goal.startDate;
  elements.goalTargetDate.value = goal.targetDate;
  elements.goalName.focus();
}

function editFixedItem(id) {
  const fixedItem = state.fixedItems.find((item) => item.id === id);
  if (!fixedItem) return;

  const kind = fixedItem.kind;
  activateTab("budgetTab");
  resetBudgetForm(kind);
  elements[`${kind}EditId`].value = fixedItem.id;
  elements[`${kind}EditMode`].value = "fixed";
  elements[`${kind}Type`].value = "fixed";
  elements[`${kind}Frequency`].value = fixedItem.frequency;
  if (kind === "expense") {
    elements.expenseCategory.value = fixedItem.expenseCategory || "other";
  }
  elements[`${kind}Description`].value = fixedItem.description;
  elements[`${kind}Amount`].value = fixedItem.amount;
  elements[`${kind}StartDate`].value = todayIso();
  updateBudgetFormFields(kind);
  elements[`${kind}Description`].focus();
}

function editInvestment(id) {
  const investment = state.investments.find((item) => item.id === id);
  if (!investment) return;

  activateTab("investmentsTab");
  elements.investmentId.value = investment.id;
  elements.investmentAlias.value = investment.alias || investment.name;
  elements.investmentBank.value = investment.bank;
  elements.investmentProductType.value = investment.productType || "policy";
  elements.investmentPrincipal.value = investment.principal;
  elements.investmentRate.value = investment.rate;
  elements.investmentMonthlyContribution.value = investment.monthlyContribution || "";
  currentExtraContributions = normalizeExtraContributions(investment.extraContributions);
  renderExtraContributions();
  elements.investmentExpectedInterest.value = investment.expectedInterest ?? calculateInvestment(investment).interest.toFixed(2);
  elements.investmentRatePeriod.value = investment.ratePeriod;
  elements.investmentInterestType.value = investment.interestType;
  elements.investmentStartDate.value = investment.startDate;
  elements.investmentEndDate.value = investment.endDate;
  elements.investmentAlias.focus();
  investmentInterestEdited =
    investment.expectedInterestManual ??
    Boolean(investment.expectedInterest !== undefined && investment.expectedInterest !== "");
  updateInvestmentProductFields();
  updateInvestmentExpectedInterest({ force: !investmentInterestEdited });
}

function resetTransactionForm() {
  elements.transactionForm.reset();
  elements.transactionId.value = "";
  elements.transactionKind.value = "income";
  elements.transactionDate.value = todayIso();
  renderCategoryOptions();
}

function resetGoalForm() {
  elements.goalForm.reset();
  elements.goalId.value = "";
  clearGoalDateValidation();
  elements.goalStartDate.value = todayIso();
  elements.goalTargetDate.value = todayIso();
}

function resetBudgetForm(kind) {
  elements[`${kind}Form`].reset();
  elements[`${kind}EditId`].value = "";
  elements[`${kind}EditMode`].value = "";
  elements[`${kind}Type`].value = "fixed";
  if (kind === "expense") {
    elements.expenseCategory.value = "food";
  }
  elements[`${kind}Date`].value = todayIso();
  elements[`${kind}StartDate`].value = todayIso();
  elements[`${kind}StartDate`].setCustomValidity("");
  elements[`${kind}Frequency`].value = "weekly";
  updateBudgetFormFields(kind);
}

function resetFixedItemForm() {
  elements.fixedItemForm.reset();
  elements.fixedItemId.value = "";
  elements.fixedItemStartDate.setCustomValidity("");
  elements.fixedItemKind.value = "income";
  elements.fixedItemFrequency.value = "weekly";
  elements.fixedItemStartDate.value = todayIso();
}

function resetInvestmentForm() {
  elements.investmentForm.reset();
  elements.investmentId.value = "";
  clearInvestmentDateValidation();
  elements.investmentMonthlyContribution.setCustomValidity("");
  elements.investmentProductType.value = "policy";
  elements.investmentMonthlyContribution.value = "";
  currentExtraContributions = [];
  renderExtraContributions();
  elements.investmentExpectedInterest.value = "";
  elements.investmentExpectedInterest.setCustomValidity("");
  elements.investmentRatePeriod.value = "annual";
  elements.investmentInterestType.value = "simple";
  elements.investmentStartDate.value = todayIso();
  elements.investmentEndDate.value = todayIso();
  elements.extraContributionDate.value = todayIso();
  elements.extraContributionAmount.value = "";
  elements.extraContributionNote.value = "";
  investmentInterestEdited = false;
  updateInvestmentProductFields();
  updateInvestmentExpectedInterest({ force: true });
}

function clearGoalDateValidation() {
  elements.goalTargetDate.setCustomValidity("");
}

function clearInvestmentDateValidation() {
  elements.investmentEndDate.setCustomValidity("");
}

function updateInvestmentProductFields() {
  const isProgrammedSavings = elements.investmentProductType.value === "programmed_savings";
  elements.monthlyContributionField.classList.toggle("is-hidden", !isProgrammedSavings);
  elements.extraContributionSection.classList.toggle("is-hidden", !isProgrammedSavings);
  elements.investmentMonthlyContribution.required = isProgrammedSavings;
  elements.investmentMonthlyContribution.setCustomValidity("");
  elements.extraContributionDate.value = elements.extraContributionDate.value || elements.investmentStartDate.value || todayIso();
  if (!isProgrammedSavings) {
    currentExtraContributions = [];
    renderExtraContributions();
  }
  elements.investmentRatePeriod.value = "annual";
  elements.investmentInterestType.value = "simple";
}

function updateInvestmentExpectedInterest(options = {}) {
  if (!options.force && investmentInterestEdited && elements.investmentExpectedInterest.value !== "") {
    return;
  }

  const result = calculateInvestment({
    productType: elements.investmentProductType.value,
    principal: Number(elements.investmentPrincipal.value || 0),
    rate: Number(elements.investmentRate.value || 0),
    monthlyContribution: Number(elements.investmentMonthlyContribution.value || 0),
    extraContributions: currentExtraContributions,
    ratePeriod: elements.investmentRatePeriod.value,
    interestType: elements.investmentInterestType.value,
    startDate: elements.investmentStartDate.value,
    endDate: elements.investmentEndDate.value
  });

  elements.investmentExpectedInterest.value = formatNumberInput(result.calculatedInterest ?? result.interest);
  elements.investmentExpectedInterest.setCustomValidity("");
}

function addExtraContribution() {
  const contribution = {
    id: createId(),
    date: elements.extraContributionDate.value,
    amount: Number(elements.extraContributionAmount.value),
    note: elements.extraContributionNote.value.trim()
  };
  const validation = validateExtraContribution(contribution);

  if (!validation.valid) {
    validation.element.setCustomValidity(validation.message);
    validation.element.reportValidity();
    return;
  }

  elements.extraContributionDate.setCustomValidity("");
  elements.extraContributionAmount.setCustomValidity("");
  currentExtraContributions.push(contribution);
  currentExtraContributions.sort((a, b) => a.date.localeCompare(b.date));
  elements.extraContributionAmount.value = "";
  elements.extraContributionNote.value = "";
  renderExtraContributions();
  updateInvestmentExpectedInterest();
}

function validateExtraContribution(contribution) {
  if (!contribution.date || contribution.date < elements.investmentStartDate.value || contribution.date > elements.investmentEndDate.value) {
    return {
      valid: false,
      element: elements.extraContributionDate,
      message: "La fecha del aporte debe estar dentro del plazo de la inversion."
    };
  }

  if (!Number.isFinite(contribution.amount) || contribution.amount <= 0) {
    return {
      valid: false,
      element: elements.extraContributionAmount,
      message: "Ingresa un monto adicional mayor a cero."
    };
  }

  return { valid: true };
}

function renderExtraContributions() {
  elements.extraContributionList.replaceChildren();

  if (currentExtraContributions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "mini-empty";
    empty.textContent = "Sin aportes extraordinarios.";
    elements.extraContributionList.append(empty);
    return;
  }

  for (const contribution of currentExtraContributions) {
    const item = document.createElement("div");
    item.className = "extra-contribution-item";
    item.innerHTML = `
      <div>
        <strong>${currency(contribution.amount)}</strong>
        <span>${formatDate(contribution.date)}${contribution.note ? ` · ${escapeHtml(contribution.note)}` : ""}</span>
      </div>
      <button type="button" data-delete-extra-contribution="${contribution.id}">Eliminar</button>
    `;
    elements.extraContributionList.append(item);
  }

  elements.extraContributionList.querySelectorAll("[data-delete-extra-contribution]").forEach((button) => {
    button.addEventListener("click", () => {
      currentExtraContributions = currentExtraContributions.filter((contribution) => contribution.id !== button.dataset.deleteExtraContribution);
      renderExtraContributions();
      updateInvestmentExpectedInterest();
    });
  });
}

function normalizeExtraContributions(extraContributions = []) {
  if (!Array.isArray(extraContributions)) return [];

  return extraContributions
    .map((contribution) => ({
      id: contribution.id || createId(),
      date: contribution.date,
      amount: Number(contribution.amount) || 0,
      note: contribution.note || ""
    }))
    .filter((contribution) => contribution.date && contribution.amount > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function removeItem(collection, id) {
  const index = collection.findIndex((item) => item.id === id);
  if (index >= 0) {
    collection.splice(index, 1);
    rememberDeletedItem(id);
    persist();
    render();
  }
}

function rememberDeletedItem(id) {
  if (!state.deletedItemIds.includes(id)) {
    state.deletedItemIds.push(id);
  }
}

function stopFixedItem(id) {
  const fixedItem = state.fixedItems.find((item) => item.id === id);
  if (!fixedItem) return;

  fixedItem.endDate = addDaysIso(todayIso(), -1);
  fixedItem.updatedAt = new Date().toISOString();
  persist();
  render();
}

function versionFixedItem(updatedItem) {
  const oldItem = state.fixedItems.find((item) => item.id === updatedItem.id);
  if (!oldItem) {
    state.fixedItems.unshift(updatedItem);
    return;
  }

  oldItem.endDate = addDaysIso(updatedItem.startDate, -1);
  oldItem.updatedAt = new Date().toISOString();
  state.fixedItems.unshift(stampRecord({
    ...updatedItem,
    id: createId(),
    previousVersionId: oldItem.id
  }));
}

function upsert(collection, item) {
  const index = collection.findIndex((current) => current.id === item.id);
  const nextItem = stampRecord(item, index >= 0 ? collection[index] : null);
  if (index >= 0) {
    collection[index] = nextItem;
  } else {
    collection.unshift(nextItem);
  }
}

function stampRecord(item, previousItem = null) {
  const now = new Date().toISOString();
  return {
    ...item,
    createdAt: item.createdAt || previousItem?.createdAt || now,
    updatedAt: now
  };
}

function loadState() {
  const fallback = {
    period: "monthly",
    transactions: [],
    goals: [],
    fixedItems: [],
    investments: [],
    deletedItemIds: [],
    liquiditySettings: {
      availableCash: 0,
      projectionMonths: 6,
      safetyMonths: 2,
      variableExpenseBuffer: 10,
      includeVariableIncome: false
    }
  };
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return {
      ...fallback,
      ...saved,
      deletedItemIds: Array.isArray(saved?.deletedItemIds) ? saved.deletedItemIds : fallback.deletedItemIds,
      liquiditySettings: {
        ...fallback.liquiditySettings,
        ...(saved?.liquiditySettings || {})
      }
    };
  } catch {
    return fallback;
  }
}

function persist() {
  persistLocalState();
  queueServerSave();
}

function persistLocalState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
  hasSavedLocalState = true;
}

function emptyState(message = "") {
  const node = elements.emptyStateTemplate.content.cloneNode(true);
  if (message) {
    node.querySelector("span").textContent = message;
  }
  return node;
}

function categoryLabel(transaction) {
  if (transaction.kind === "income") {
    return incomeCategories.find((category) => category.value === transaction.category)?.label || "Sin categoria";
  }

  const expenseType = {
    fixed: "Gasto fijo",
    variable: "Gasto variable",
    unique: "Gasto unico",
    emergency: "Gasto emergente"
  }[transaction.category] || "Gasto";
  const expenseCategory =
    expenseCategories.find((category) => category.value === transaction.expenseCategory)?.label || "Sin categoria";

  return `${expenseType} · ${expenseCategory}`;
}

function periodName(period) {
  return {
    monthly: "Mes",
    biweekly: "Quincena",
    weekly: "Semana"
  }[period];
}

function frequencyLabel(frequency) {
  return {
    weekly: "semanal",
    monthly: "mensual"
  }[frequency];
}

function statusLabel(status) {
  return {
    active: "Activa",
    finished: "Finalizada",
    upcoming: "Por iniciar"
  }[status];
}

function productLabel(productType = "policy") {
  return investmentProducts.find((product) => product.value === productType)?.label || "Poliza";
}

function formatPercent(value) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatNumberInput(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character];
  });
}

function normalizeSearch(value) {
  return value.trim().toLowerCase();
}

function getBudgetTransactions(range) {
  return [...state.transactions, ...generateFixedTransactions(state.fixedItems, range)];
}

function addDaysIso(date, days) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return toIsoDate(value);
}

async function hydrateServerState() {
  updateSyncStatus("syncing");
  try {
    const serverState = await readServerState();
    if (!serverState || Object.keys(serverState).length === 0) {
      if (hasStoredRecords(state)) {
        queueServerSave();
      } else {
        updateSyncStatus("local");
      }
      return;
    }

    applyServerState(serverState, !hasSavedLocalState);
    queueServerSave();
  } catch {
    updateSyncStatus("offline");
    scheduleServerRetry();
  }
}

async function syncFromServer() {
  if (isSavingServerState) return;
  if (pendingServerSave) {
    flushServerSave();
    return;
  }

  try {
    const serverState = await readServerState();
    if (!serverState || Object.keys(serverState).length === 0) {
      if (hasStoredRecords(state)) queueServerSave();
      return;
    }

    applyServerState(serverState, true);
    if (!hasAllSharedRecords(state, serverState)) {
      queueServerSave();
    } else {
      updateSyncStatus("synced");
    }
  } catch {
    updateSyncStatus("offline");
    scheduleServerRetry();
  }
}

async function readServerState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("No se pudo leer la copia central.");
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("La copia central no respondio JSON.");
  }

  const serverState = await response.json();
  return serverState && typeof serverState === "object" ? serverState : {};
}

function applyServerState(serverState, preferServer) {
  const previousFingerprint = stateFingerprint(state);
  const reconciledState = preferServer ? mergeStateCopies(serverState, state) : mergeStateCopies(state, serverState);

  Object.assign(state, reconciledState);
  persistLocalState();
  syncControlsFromState();

  const currentFingerprint = stateFingerprint(state);
  if (currentFingerprint !== previousFingerprint) {
    render();
  }
  lastSyncedFingerprint = currentFingerprint;
}

async function saveServerState() {
  const latest = await readServerState();
  const mergedState = mergeStateCopies(state, latest);
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mergedState)
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar la copia central.");
  }

  const savedState = await response.json();
  if (!hasAllSharedRecords(mergedState, savedState)) {
    throw new Error("La copia central no confirmo todos los registros.");
  }

  Object.assign(state, mergeStateCopies(savedState, state));
  persistLocalState();
  lastSyncedFingerprint = stateFingerprint(state);
  updateSyncStatus("synced");
}

function queueServerSave() {
  pendingServerSave = true;
  if (!isSavingServerState) {
    flushServerSave();
  }
}

async function flushServerSave() {
  if (!pendingServerSave) return;

  pendingServerSave = false;
  isSavingServerState = true;
  updateSyncStatus("syncing");

  try {
    await saveServerState();
  } catch {
    pendingServerSave = true;
    updateSyncStatus("offline");
    scheduleServerRetry();
  } finally {
    isSavingServerState = false;
  }
}

function scheduleServerRetry() {
  if (syncRetryTimer) return;

  syncRetryTimer = setTimeout(() => {
    syncRetryTimer = null;
    if (pendingServerSave || stateFingerprint(state) !== lastSyncedFingerprint) {
      pendingServerSave = true;
      flushServerSave();
    } else {
      syncFromServer();
    }
  }, syncRetryDelay);
}

function updateSyncStatus(status) {
  if (!elements.syncStatus) return;

  const labels = {
    syncing: "Sincronizando",
    synced: "Sincronizado",
    local: "Guardado local",
    offline: "Pendiente de sincronizar"
  };

  elements.syncStatus.textContent = labels[status] || labels.local;
  elements.syncStatus.className = `sync-status ${status}`;
}

function syncControlsFromState() {
  if (!state.liquiditySettings) {
    state.liquiditySettings = {
      availableCash: 0,
      projectionMonths: 6,
      safetyMonths: 2,
      variableExpenseBuffer: 10,
      includeVariableIncome: false
    };
  }

  elements.periodSelect.value = state.period;
  elements.availableCash.value = state.liquiditySettings.availableCash || "";
  elements.projectionMonths.value = state.liquiditySettings.projectionMonths;
  elements.safetyMonths.value = state.liquiditySettings.safetyMonths;
  elements.variableExpenseBuffer.value = state.liquiditySettings.variableExpenseBuffer;
  elements.includeVariableIncome.checked = state.liquiditySettings.includeVariableIncome;
}
