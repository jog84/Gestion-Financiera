mod commands;
mod db;
mod services;

use tauri::Manager;

use commands::{
    accounts::{
        create_financial_account, create_financial_transfer, delete_financial_account,
        delete_financial_transfer, get_account_balance_history, get_account_ledger,
        get_cash_overview, get_financial_accounts, get_financial_transfers,
        update_financial_account,
    },
    alerts::{
        check_budget_alerts, create_alert, delete_alert, get_alerts, mark_alert_read,
        mark_all_alerts_read,
    },
    assets::{create_asset, delete_asset, get_assets, update_asset},
    budgets::{delete_budget, get_budgets, upsert_budget},
    charts::{get_expense_breakdown, get_installment_cashflow, get_monthly_summary},
    dashboard::{
        check_financial_alerts, get_dashboard_summary, get_financial_insights,
        get_financial_overview, get_financial_recommendations,
    },
    excel::{export_excel_template, import_excel_rows},
    expenses::{create_expense, delete_expense, get_expenses, update_expense},
    goals::{create_goal, delete_goal, get_goals, update_goal_amount, update_goal_status},
    incomes::{create_income, delete_income, get_incomes, update_income},
    installments::{create_installment, delete_installment, get_installments},
    inversiones_integration::{
        autodetect_inversiones_integration, get_inversiones_integration_settings,
        reset_inversiones_integration_settings, save_inversiones_integration_settings,
        test_inversiones_integration,
    },
    investments::{
        create_investment, delete_investment, get_investments, get_portfolio_snapshots,
        save_portfolio_snapshot, update_investment_value,
    },
    milestones::{check_and_mark_milestones, create_milestone, delete_milestone, get_milestones},
    net_worth::{get_net_worth_history, save_net_worth_snapshot},
    prices::{fetch_ccl, fetch_prices, update_prices_by_ticker},
    profiles::{create_profile, get_profiles},
    recurring::{
        apply_due_recurring, create_recurring_transaction, delete_recurring_transaction,
        get_recurring_transactions, toggle_recurring_active, update_recurring_transaction,
    },
    reports::{get_annual_report, get_recent_transactions, get_yoy_comparison},
    settings::{
        copy_db_to_location, create_db_backup, get_db_backup_directory, get_db_location,
        get_default_profile, list_db_backups, reset_db_location, set_db_location, update_profile,
    },
    signals::{
        add_ticker_to_inversiones, fetch_inversiones_signals, fetch_ticker_analysis,
        search_inversiones_instruments,
    },
    sources::{
        create_expense_category, create_income_source, delete_expense_category,
        delete_income_source, get_expense_categories, get_income_sources, update_expense_category,
        update_income_source,
    },
    themes::{activate_theme, create_theme, deactivate_all_themes, delete_theme, get_themes},
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
            get_financial_transfers,
            create_financial_transfer,
            delete_financial_transfer,
            get_account_ledger,
            get_account_balance_history,
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
            get_financial_insights,
            get_financial_recommendations,
            check_financial_alerts,
            export_excel_template,
            import_excel_rows,
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
            get_db_backup_directory,
            list_db_backups,
            create_db_backup,
            get_inversiones_integration_settings,
            save_inversiones_integration_settings,
            reset_inversiones_integration_settings,
            autodetect_inversiones_integration,
            test_inversiones_integration,
            // Prices
            fetch_prices,
            fetch_ccl,
            update_prices_by_ticker,
            // Inversiones AR integration
            fetch_inversiones_signals,
            fetch_ticker_analysis,
            add_ticker_to_inversiones,
            search_inversiones_instruments,
            // Themes
            get_themes,
            create_theme,
            activate_theme,
            deactivate_all_themes,
            delete_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
