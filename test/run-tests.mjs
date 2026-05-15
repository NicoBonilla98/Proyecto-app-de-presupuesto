import assert from "node:assert/strict";
import {
  calculateBudgetProgress,
  calculateInvestment,
  calculateSavingsPlan,
  calculateTotals,
  generateFixedTransactions,
  getPeriodRange,
  investmentNeedsRenewalAlert,
  summarizeInvestments,
  validateDateWindow
} from "../src/finance.js";
import {
  calculateInvestmentCapacity,
  calculateSafetyNet,
  estimateMonthlyVariableCashflow
} from "../src/liquidity.js";
import { createId } from "../src/ids.js";
import { hasAllSharedRecords, hasStoredRecords, mergeStateCopies, stateFingerprint } from "../src/state-sync.js";

const tests = [
  {
    name: "calcula totales del periodo mensual",
    run() {
      const range = getPeriodRange("2026-05-09", "monthly");
      const totals = calculateTotals(
        [
          { kind: "income", amount: 1000, date: "2026-05-01" },
          { kind: "expense", amount: 250, date: "2026-05-05" },
          { kind: "expense", amount: 99, date: "2026-06-01" }
        ],
        range
      );

      assert.equal(totals.income, 1000);
      assert.equal(totals.expense, 250);
      assert.equal(totals.balance, 750);
    }
  },
  {
    name: "calcula progreso de presupuesto del periodo",
    run() {
      const range = getPeriodRange("2026-05-14", "monthly");
      const progress = calculateBudgetProgress({ income: 12450, expense: 8000 }, range, "2026-05-14");

      assert.equal(progress.remaining, 4450);
      assert.equal(Math.round(progress.usagePercent * 10) / 10, 64.3);
      assert.equal(progress.daysRemaining, 18);
      assert.equal(Math.round(progress.dailyAvailable * 100) / 100, 247.22);
      assert.equal(progress.isOverBudget, false);
    }
  },
  {
    name: "marca presupuesto excedido cuando gastos superan ingresos",
    run() {
      const range = getPeriodRange("2026-05-14", "monthly");
      const progress = calculateBudgetProgress({ income: 500, expense: 750 }, range, "2026-05-14");

      assert.equal(progress.remaining, -250);
      assert.equal(progress.cappedUsagePercent, 100);
      assert.equal(progress.dailyAvailable, 0);
      assert.equal(progress.isOverBudget, true);
    }
  },
  {
    name: "calcula rango quincenal",
    run() {
      assert.deepEqual(getPeriodRange("2026-05-09", "biweekly"), {
        start: "2026-05-01",
        end: "2026-05-15"
      });

      assert.deepEqual(getPeriodRange("2026-05-20", "biweekly"), {
        start: "2026-05-16",
        end: "2026-05-31"
      });
    }
  },
  {
    name: "genera ingresos fijos semanales dentro del mes",
    run() {
      const range = getPeriodRange("2026-05-09", "monthly");
      const transactions = generateFixedTransactions(
        [
          {
            id: "salary",
            kind: "income",
            frequency: "weekly",
            description: "Sueldo semanal",
            amount: 250,
            startDate: "2026-05-01"
          }
        ],
        range
      );

      assert.deepEqual(
        transactions.map((transaction) => transaction.date),
        ["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22", "2026-05-29"]
      );
      assert.equal(calculateTotals(transactions, range).income, 1250);
    }
  },
  {
    name: "conserva categoria de gasto en gastos fijos generados",
    run() {
      const range = getPeriodRange("2026-05-09", "monthly");
      const transactions = generateFixedTransactions(
        [
          {
            id: "rent",
            kind: "expense",
            frequency: "monthly",
            description: "Arriendo",
            amount: 500,
            expenseCategory: "housing",
            startDate: "2026-05-01"
          }
        ],
        range
      );

      assert.equal(transactions.length, 1);
      assert.equal(transactions[0].category, "fixed");
      assert.equal(transactions[0].expenseCategory, "housing");
    }
  },
  {
    name: "mantiene versiones pasadas de un fijo sin afectar el futuro",
    run() {
      const range = getPeriodRange("2026-05-09", "monthly");
      const transactions = generateFixedTransactions(
        [
          {
            id: "old",
            kind: "income",
            frequency: "weekly",
            description: "Sueldo anterior",
            amount: 200,
            startDate: "2026-05-01",
            endDate: "2026-05-14"
          },
          {
            id: "new",
            kind: "income",
            frequency: "weekly",
            description: "Sueldo nuevo",
            amount: 300,
            startDate: "2026-05-15"
          }
        ],
        range
      );

      assert.deepEqual(
        transactions.map((transaction) => `${transaction.date}:${transaction.amount}`),
        ["2026-05-01:200", "2026-05-08:200", "2026-05-15:300", "2026-05-22:300", "2026-05-29:300"]
      );
    }
  },
  {
    name: "calcula ahorro mensual restante",
    run() {
      const plan = calculateSavingsPlan(
        {
          target: 1200,
          saved: 200,
          startDate: "2026-05-01",
          targetDate: "2026-08-01"
        },
        "monthly"
      );

      assert.equal(plan.remaining, 1000);
      assert.equal(plan.periods, 4);
      assert.equal(plan.amount, 250);
    }
  },
  {
    name: "calcula inversion con interes simple anual",
    run() {
      const result = calculateInvestment(
        {
          principal: 1000,
          rate: 12,
          ratePeriod: "annual",
          interestType: "simple",
          startDate: "2026-01-01",
          endDate: "2027-01-01"
        },
        "2026-06-01"
      );

      assert.equal(result.principal, 1000);
      assert.equal(result.annualRate, 0.12);
      assert.equal(Math.round(result.finalAmount), 1120);
      assert.equal(result.status, "active");
    }
  },
  {
    name: "usa interes negociado cuando se ingresa manualmente",
    run() {
      const result = calculateInvestment(
        {
          principal: 1000,
          rate: 12,
          expectedInterest: 150,
          expectedInterestManual: true,
          ratePeriod: "annual",
          interestType: "simple",
          startDate: "2026-01-01",
          endDate: "2027-01-01"
        },
        "2026-06-01"
      );

      assert.equal(result.calculatedInterest, 120);
      assert.equal(result.interest, 150);
      assert.equal(result.finalAmount, 1150);
    }
  },
  {
    name: "ignora interes sugerido cuando no fue editado manualmente",
    run() {
      const result = calculateInvestment(
        {
          principal: 1000,
          rate: 12,
          expectedInterest: 150,
          expectedInterestManual: false,
          ratePeriod: "annual",
          interestType: "simple",
          startDate: "2026-01-01",
          endDate: "2027-01-01"
        },
        "2026-06-01"
      );

      assert.equal(result.calculatedInterest, 120);
      assert.equal(result.interest, 120);
      assert.equal(result.finalAmount, 1120);
    }
  },
  {
    name: "resume inversiones y proximo vencimiento",
    run() {
      const summary = summarizeInvestments(
        [
          {
            principal: 500,
            rate: 1,
            ratePeriod: "monthly",
            interestType: "compound",
            startDate: "2026-01-01",
            endDate: "2026-07-01"
          },
          {
            principal: 300,
            rate: 8,
            ratePeriod: "annual",
            interestType: "simple",
            startDate: "2026-01-01",
            endDate: "2026-05-01"
          }
        ],
        "2026-05-09"
      );

      assert.equal(summary.principal, 800);
      assert.equal(summary.nextDue.endDate, "2026-07-01");
      assert.ok(summary.finalAmount > summary.principal);
    }
  },
  {
    name: "activa alerta de renovacion a una semana del vencimiento",
    run() {
      const investment = {
        principal: 1000,
        rate: 8,
        ratePeriod: "annual",
        interestType: "simple",
        startDate: "2026-01-01",
        endDate: "2026-05-16"
      };

      assert.equal(investmentNeedsRenewalAlert(investment, "2026-05-09"), true);
      assert.equal(investmentNeedsRenewalAlert(investment, "2026-05-08"), false);
      assert.equal(investmentNeedsRenewalAlert(investment, "2026-05-17"), false);
    }
  },
  {
    name: "no activa alerta de renovacion para ahorros flexibles",
    run() {
      const investment = {
        productType: "flexible_savings",
        principal: 1000,
        rate: 2,
        ratePeriod: "annual",
        interestType: "simple",
        startDate: "2026-01-01",
        endDate: "2026-05-16"
      };

      assert.equal(investmentNeedsRenewalAlert(investment, "2026-05-09"), false);
    }
  },
  {
    name: "calcula ahorro programado con aportes mensuales",
    run() {
      const result = calculateInvestment(
        {
          productType: "programmed_savings",
          principal: 1000,
          rate: 12,
          monthlyContribution: 100,
          ratePeriod: "annual",
          interestType: "simple",
          startDate: "2026-01-01",
          endDate: "2026-03-01"
        },
        "2026-02-01"
      );

      assert.equal(result.months, 3);
      assert.equal(result.totalContributions, 300);
      assert.ok(result.finalAmount > 1300);
      assert.ok(result.interest > 0);
    }
  },
  {
    name: "calcula aportes extraordinarios desde el dia exacto",
    run() {
      const result = calculateInvestment(
        {
          productType: "programmed_savings",
          principal: 1000,
          rate: 36.5,
          monthlyContribution: 0,
          extraContributions: [{ date: "2026-01-06", amount: 1000, note: "Bono" }],
          ratePeriod: "annual",
          interestType: "simple",
          startDate: "2026-01-01",
          endDate: "2026-01-11"
        },
        "2026-01-01"
      );
      const expectedFinalAmount = 1000 * 1.001 ** 10 + 1000 * 1.001 ** 5;

      assert.equal(result.totalExtraContributions, 1000);
      assert.ok(Math.abs(result.finalAmount - expectedFinalAmount) < 0.01);
      assert.ok(result.interest > 15);
    }
  },
  {
    name: "calcula ahorro flexible con interes diario compuesto",
    run() {
      const result = calculateInvestment(
        {
          productType: "flexible_savings",
          principal: 1000,
          rate: 3,
          ratePeriod: "annual",
          interestType: "simple",
          startDate: "2026-01-01",
          endDate: "2026-04-01"
        },
        "2026-02-01"
      );

      assert.ok(result.finalAmount > 1000);
      assert.equal(result.totalContributions, 0);
      assert.equal(result.calculationLabel, "Ahorro flexible con interes compuesto diario");
    }
  },
  {
    name: "valida que la fecha final sea posterior y al menos 15 dias despues",
    run() {
      assert.equal(validateDateWindow("2026-05-20", "2026-05-19").valid, false);
      assert.equal(validateDateWindow("2026-05-01", "2026-05-10").valid, false);
      assert.equal(validateDateWindow("2026-05-01", "2026-05-16").valid, true);
    }
  },
  {
    name: "calcula safety net por meses de cobertura",
    run() {
      assert.equal(calculateSafetyNet(800, 2), 1600);
    }
  },
  {
    name: "estima gasto variable mensual con buffer",
    run() {
      const estimate = estimateMonthlyVariableCashflow(
        [
          { kind: "expense", category: "variable", amount: 100, date: "2026-04-01" },
          { kind: "expense", category: "unique", amount: 200, date: "2026-05-01" },
          { kind: "income", category: "variable", amount: 500, date: "2026-05-02" }
        ],
        { variableExpenseBuffer: 10, includeVariableIncome: false }
      );

      assert.equal(estimate.monthlyVariableExpenses, 165);
      assert.equal(estimate.monthlyVariableIncome, 0);
    }
  },
  {
    name: "genera ids aunque randomUUID no exista en intranet",
    run() {
      const id = createId({
        getRandomValues(values) {
          values[0] = 123;
          values[1] = 456;
          return values;
        }
      });

      assert.ok(id.endsWith("-3f-co"));
      assert.equal(typeof createId(undefined), "string");
    }
  },
  {
    name: "reconcilia estado local con servidor vacio sin perder presupuesto",
    run() {
      const localState = {
        transactions: [{ id: "tx-local", description: "Ingreso local" }],
        fixedItems: [{ id: "fixed-local", description: "Sueldo" }],
        goals: [],
        investments: [{ id: "investment-local", alias: "Poliza" }],
        liquiditySettings: { availableCash: 100 }
      };
      const serverState = {
        transactions: [],
        fixedItems: [],
        goals: [],
        investments: [],
        liquiditySettings: { availableCash: 0 }
      };
      const merged = mergeStateCopies(localState, serverState);

      assert.equal(merged.transactions.length, 1);
      assert.equal(merged.fixedItems.length, 1);
      assert.equal(merged.investments.length, 1);
      assert.equal(merged.liquiditySettings.availableCash, 100);
      assert.equal(hasStoredRecords(merged), true);
    }
  },
  {
    name: "reconcilia servidor con navegador nuevo",
    run() {
      const localState = {
        transactions: [],
        fixedItems: [],
        goals: [],
        investments: [],
        liquiditySettings: { availableCash: 0 }
      };
      const serverState = {
        transactions: [{ id: "tx-server", description: "Ingreso servidor" }],
        fixedItems: [],
        goals: [],
        investments: [],
        liquiditySettings: { availableCash: 250 }
      };
      const merged = mergeStateCopies(serverState, localState);

      assert.equal(merged.transactions.length, 1);
      assert.equal(merged.transactions[0].id, "tx-server");
      assert.equal(merged.liquiditySettings.availableCash, 250);
    }
  },
  {
    name: "mantiene eliminaciones al reconciliar copias",
    run() {
      const merged = mergeStateCopies(
        {
          transactions: [],
          fixedItems: [],
          goals: [],
          investments: [],
          deletedItemIds: ["tx-deleted"]
        },
        {
          transactions: [{ id: "tx-deleted", description: "No debe volver" }],
          fixedItems: [],
          goals: [],
          investments: []
        }
      );

      assert.equal(merged.transactions.length, 0);
      assert.deepEqual(merged.deletedItemIds, ["tx-deleted"]);
      assert.equal(hasStoredRecords({ deletedItemIds: ["tx-deleted"] }), true);
    }
  },
  {
    name: "un dispositivo atrasado no revive datos eliminados del servidor",
    run() {
      const staleDeviceState = {
        transactions: [{ id: "tx-deleted", description: "Dato viejo" }],
        fixedItems: [],
        goals: [],
        investments: [],
        deletedItemIds: []
      };
      const centralState = {
        transactions: [],
        fixedItems: [],
        goals: [],
        investments: [],
        deletedItemIds: ["tx-deleted"]
      };
      const merged = mergeStateCopies(staleDeviceState, centralState);

      assert.equal(merged.transactions.length, 0);
      assert.deepEqual(merged.deletedItemIds, ["tx-deleted"]);
    }
  },
  {
    name: "mantiene la version mas reciente del mismo registro",
    run() {
      const staleDeviceState = {
        fixedItems: [
          {
            id: "fixed-1",
            description: "Sueldo",
            amount: 100,
            updatedAt: "2026-05-10T10:00:00.000Z"
          }
        ]
      };
      const centralState = {
        fixedItems: [
          {
            id: "fixed-1",
            description: "Sueldo detenido",
            amount: 100,
            endDate: "2026-05-09",
            updatedAt: "2026-05-10T11:00:00.000Z"
          }
        ]
      };
      const merged = mergeStateCopies(staleDeviceState, centralState);

      assert.equal(merged.fixedItems.length, 1);
      assert.equal(merged.fixedItems[0].description, "Sueldo detenido");
      assert.equal(merged.fixedItems[0].endDate, "2026-05-09");
    }
  },
  {
    name: "verifica que la copia central tenga los registros compartidos",
    run() {
      const expected = {
        transactions: [{ id: "tx-1" }],
        fixedItems: [],
        goals: [],
        investments: [{ id: "inv-1" }],
        deletedItemIds: ["old-tx"]
      };
      const complete = {
        transactions: [{ id: "tx-1" }],
        fixedItems: [],
        goals: [],
        investments: [{ id: "inv-1" }],
        deletedItemIds: ["old-tx"]
      };
      const incomplete = {
        transactions: [{ id: "tx-1" }],
        fixedItems: [],
        goals: [],
        investments: [],
        deletedItemIds: []
      };
      const invalidDeletedRecord = {
        transactions: [{ id: "old-tx" }],
        fixedItems: [],
        goals: [],
        investments: [{ id: "inv-1" }],
        deletedItemIds: ["old-tx"]
      };

      assert.equal(hasAllSharedRecords(expected, complete), true);
      assert.equal(hasAllSharedRecords(expected, incomplete), false);
      assert.equal(hasAllSharedRecords(expected, invalidDeletedRecord), false);
      assert.equal(typeof stateFingerprint(complete), "string");
    }
  },
  {
    name: "calcula capacidad de inversion respetando safety net",
    run() {
      const result = calculateInvestmentCapacity(
        {
          transactions: [],
          fixedItems: [
            {
              id: "salary",
              kind: "income",
              frequency: "monthly",
              description: "Sueldo",
              amount: 1200,
              startDate: "2026-05-01"
            },
            {
              id: "rent",
              kind: "expense",
              frequency: "monthly",
              description: "Arriendo",
              amount: 500,
              startDate: "2026-05-01"
            }
          ],
          goals: [],
          investments: []
        },
        {
          availableCash: 1000,
          projectionMonths: 2,
          safetyMonths: 1,
          variableExpenseBuffer: 0,
          includeVariableIncome: false,
          startDate: "2026-05-09"
        }
      );

      assert.equal(result.safetyNet, 500);
      assert.equal(result.capacity, 1200);
      assert.equal(result.projections.length, 2);
    }
  }
];

for (const test of tests) {
  test.run();
  console.log(`OK ${test.name}`);
}

console.log(`\n${tests.length} pruebas completadas.`);
