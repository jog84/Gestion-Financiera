import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { Skeleton } from "@/components/ui/Skeleton";

type CashflowTableCardProps = {
  isLoading: boolean;
  isEmpty: boolean;
  loadingColumns?: string[];
  emptyState: ReactNode;
  children: ReactNode;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
};

export function CashflowTableCard({
  isLoading,
  isEmpty,
  loadingColumns = ["15%", "30%", "25%", "10%"],
  emptyState,
  children,
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: CashflowTableCardProps) {
  return (
    <Card className="animate-fade-in-up delay-100" style={{ padding: 0, overflow: "hidden" }}>
      {isLoading ? (
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <div key={rowIndex} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              {loadingColumns.map((width, columnIndex) => (
                <Skeleton key={columnIndex} style={{ height: "24px", width, marginLeft: columnIndex === loadingColumns.length - 1 ? "auto" : undefined }} />
              ))}
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        emptyState
      ) : (
        <>
          {children}
          <Pagination
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </>
      )}
    </Card>
  );
}
