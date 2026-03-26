mod commands;
mod db;
mod services;

use tauri::Manager;

use commands::{
    accounts::{create_financial_account, delete_financial_account, get_cash_overview, get_financial_accounts, update_financial_account},
    alerts::{get_alerts, create_alert, mark_alert_read, mark_all_alerts_read, delete_alert, check_budget_alerts},
    assets::{create_asset, delete_asset, get_assets, update_asset},
    budgets::{get_budgets, upsert_budget, delete_budget},
    charts::{get_expense_breakdown, get_monthly_summary, get_installment_cashflow},
    dashboard::{get_dashboard_summary, get_financial_overview},
    expenses::{create_expense, delete_expense, get_expenses, update_expense},
    goals::{create_goal, delete_goal, get_goals, update_goal_amount, update_goal_status},
    incomes::{create_income, delete_income, get_incomes, update_income},
    installments::{create_installment, delete_installment, get_installments},
    investments::{create_investment, delete_investment, get_investments, update_investment_value, save_portfolio_snapshot, get_portfolio_snapshots},
    milestones::{get_milestones, create_milestone, delete_milestone, check_and_mark_milestones},
    net_worth::{get_net_worth_history, save_net_worth_snapshot},
    profiles::{create_profile, get_profiles},
    recurring::{get_recurring_transactions, create_recurring_transaction, update_recurring_transaction, delete_recurring_transaction, toggle_recurring_active, apply_due_recurring},
    reports::{get_annual_report, get_recent_transactions, get_yoy_comparison},
    settings::{get_default_profile, update_profile, get_db_location, set_db_location, reset_db_location, copy_db_to_location},
    prices::{fetch_prices, fetch_ccl, update_prices_by_ticker},
    files::save_excel_file,
    sources::{create_expense_category, create_income_source, get_expense_categories, get_income_sources, update_income_source, delete_income_source, update_expense_category, delete_expense_category},
    themes::{get_themes, create_theme, activate_theme, deactivate_all_themes, delete_theme},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                match db::init_db(&handle).await {
                    Ok(pool) => {
                        handle.manage(pool);
                    }
                    Err(e) => {
                        eprintln!("FALLO AL INICIALIZAR LA BASE DE DATOS: {}", e);
                        // In a real app, we should show a dialog here.
                        // For now, this avoids the panic and allows the app to potentially
                        // show a frontend error if it manages to load.
                        // Or we can force exit if it's critical.
                        std::process::exit(1);
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Profiles
            get_profiles,
            create_profile,
            // Accounts
            get_financial_accounts,
            create_financial_account,
            update_financial_account,
            delete_financial_account,
            get_cash_overview,
            // Incomes
            get_incomes,
            create_income,
            update_income,
            delete_income,
            // Expenses
            get_expenses,
            create_expense,
            update_expense,
            delete_expense,
            // Dashboard & Charts
            get_dashboard_summary,
            get_financial_overview,
            get_monthly_summary,
            get_expense_breakdown,
            get_installment_cashflow,
            // Sources & Categories
            get_income_sources,
            create_income_source,
            update_income_source,
            delete_income_source,
            get_expense_categories,
            create_expense_category,
            update_expense_category,
            delete_expense_category,
            // Installments
            get_installments,
            create_installment,
            delete_installment,
            // Investments
            get_investments,
            create_investment,
            update_investment_value,
            delete_investment,
            save_portfolio_snapshot,
            get_portfolio_snapshots,
            // Assets
            get_assets,
            create_asset,
            update_asset,
            delete_asset,
            // Goals
            get_goals,
            create_goal,
            update_goal_amount,
            update_goal_status,
            delete_goal,
            // Milestones
            get_milestones,
            create_milestone,
            delete_milestone,
            check_and_mark_milestones,
            // Budgets
            get_budgets,
            upsert_budget,
            delete_budget,
            // Alerts
            get_alerts,
            create_alert,
            mark_alert_read,
            mark_all_alerts_read,
            delete_alert,
            check_budget_alerts,
            // Recurring
            get_recurring_transactions,
            create_recurring_transaction,
            update_recurring_transaction,
            delete_recurring_transaction,
            toggle_recurring_active,
            apply_due_recurring,
            // Net worth history
            get_net_worth_history,
            save_net_worth_snapshot,
            // Reports
            get_recent_transactions,
            get_annual_report,
            get_yoy_comparison,
            // Settings
            get_default_profile,
            update_profile,
            get_db_location,
            set_db_location,
            reset_db_location,
            copy_db_to_location,
            // Prices
            fetch_prices,
            fetch_ccl,
            update_prices_by_ticker,
            // Themes
            get_themes,
            create_theme,
            activate_theme,
            deactivate_all_themes,
            delete_theme,
            // Files
            save_excel_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
