import { invoke } from "@tauri-apps/api/core";
import type {
  ImportedAsset,
  ImportedExpense,
  ImportedGoal,
  ImportedIncome,
  ImportedInstallment,
  ImportedInvestment,
} from "@/lib/excel.types";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

async function importRows<T>(importKind: string, file: File): Promise<T[]> {
  const base64Data = await fileToBase64(file);
  return invoke<T[]>("import_excel_rows", { importKind, base64Data });
}

async function exportTemplate(templateKind: string) {
  return invoke<string>("export_excel_template", { templateKind });
}

export type {
  ImportedAsset,
  ImportedExpense,
  ImportedGoal,
  ImportedIncome,
  ImportedInstallment,
  ImportedInvestment,
};

export async function exportIncomesTemplate() {
  return exportTemplate("incomes");
}

export async function importIncomes(file: File): Promise<ImportedIncome[]> {
  return importRows<ImportedIncome>("incomes", file);
}

export async function exportExpensesTemplate() {
  return exportTemplate("expenses");
}

export async function importExpenses(file: File): Promise<ImportedExpense[]> {
  return importRows<ImportedExpense>("expenses", file);
}

export async function exportInstallmentsTemplate() {
  return exportTemplate("installments");
}

export async function importInstallments(file: File): Promise<ImportedInstallment[]> {
  return importRows<ImportedInstallment>("installments", file);
}

export async function exportInvestmentsTemplate() {
  return exportTemplate("investments");
}

export async function importInvestments(file: File): Promise<ImportedInvestment[]> {
  return importRows<ImportedInvestment>("investments", file);
}

export async function exportAssetsTemplate() {
  return exportTemplate("assets");
}

export async function importAssets(file: File): Promise<ImportedAsset[]> {
  return importRows<ImportedAsset>("assets", file);
}

export async function exportGoalsTemplate() {
  return exportTemplate("goals");
}

export async function importGoals(file: File): Promise<ImportedGoal[]> {
  return importRows<ImportedGoal>("goals", file);
}
