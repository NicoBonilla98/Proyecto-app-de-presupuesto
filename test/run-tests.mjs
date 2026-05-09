import assert from "node:assert/strict";
import {
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
