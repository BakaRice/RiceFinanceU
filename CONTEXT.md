# RiceFinanceU Domain Language

RiceFinanceU is a personal asset snapshot ledger. Its language separates asset stock, income flow, and spendability so financial analysis does not blur money that can be used today with money that only explains long-term assets.

## Language

**Asset Snapshot**:
A point-in-time statement of asset balances.
_Avoid_: Transaction, income record

**Income Flow**:
Money received during a period, recorded separately from asset balances.
_Avoid_: Asset balance, snapshot value

**Spendable Income**:
Tax-after income that can reasonably be treated as available cash or near-cash for current use.
_Avoid_: Total income

**Restricted Income**:
Tax-after income that contributes to long-term asset analysis but should not be treated as currently spendable.
_Avoid_: Disposable income, cash income

**Housing Fund Flow**:
Housing fund contribution or inflow during a period. It is restricted income.
_Avoid_: Housing fund asset balance

**Housing Fund Asset**:
The current balance of a housing fund account at a snapshot point.
_Avoid_: Housing fund income
