/* types/loan.ts */
export interface LoanCalculation {
  down_payment: number;
  loan_amount: number;
  monthly_payment: number;
  total_payment: number;
  total_interest: number;
  commercial_rate?: number;
  provident_fund_rate?: number;
  provident_fund_loan?: number;
  commercial_loan?: number;
  loan_term_years?: number;
  rate_source?: string;
}
