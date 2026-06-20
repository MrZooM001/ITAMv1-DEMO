import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GridComponent, ColumnsDirective, ColumnDirective, Inject,
  Sort, Filter, Toolbar, ExcelExport, PdfExport, ColumnChooser, Page, Resize,
} from "@syncfusion/ej2-react-grids";
import { useDepartments, useDeleteDepartment } from "../../features/departments/hooks/useDepartments";
import DepartmentForm from "../../features/departments/components/DepartmentForm";
import ConfirmDialog  from "../../components/ui/ConfirmDialog";
import { MdAdd, MdBusiness, MdEdit, MdDelete } from "react-icons/md";

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DepartmentList() {
  const navigate   = useNavigate();
  const gridRef    = useRef(null);
  const deleteMut  = useDeleteDepartment();

  const { data: departments, isLoading, isError } = useDepartments();

  const [formOpen,    setFormOpen]    = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [deleteTarget,setDeleteTarget]= useState(null);
  const [deleteError, setDeleteError] = useState(null);

  function toolbarClick(args) {
    if (!gridRef.current) return;
    if (args.item.id === "grid_excelexport") gridRef.current.excelExport();
    if (args.item.id === "grid_pdfexport")   gridRef.current.pdfExport();
    if (args.item.id === "grid_csvexport")   gridRef.current.csvExport();
  }

  async function handleDelete() {
    setDeleteError(null);
    try {
      await deleteMut.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  // ── Column: Actions ────────────────────────────────────────
  function ActionsTemplate(row) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); setEditTarget(row); setFormOpen(true); }}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <MdEdit className="text-base" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(row); }}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
        >
          <MdDelete className="text-base" />
        </button>
      </div>
    );
  }

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (isError) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <p className="text-red-500 text-sm">Failed to load departments.</p>
    </div>
  );

  return (
    <div className="space-y-5 max-w-full">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-400 mt-0.5">{departments?.length ?? 0} departments</p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setFormOpen(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700
            text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          <MdAdd className="text-lg" />
          Add Department
        </button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total departments",  value: departments?.length ?? 0,  color: "bg-blue-500" },
          { label: "Total employees",    value: departments?.reduce((s, d) => s + (d.employee_count ?? 0), 0), color: "bg-purple-500" },
          { label: "Total devices",      value: departments?.reduce((s, d) => s + (d.device_count   ?? 0), 0), color: "bg-teal-500"   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <MdBusiness className="text-white text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <GridComponent
          id="grid"
          ref={gridRef}
          dataSource={departments ?? []}
          allowSorting allowFiltering allowResizing
          showColumnChooser allowExcelExport allowPdfExport allowPaging
          filterSettings={{ type: "Menu" }}
          pageSettings={{ pageSize: 15 }}
          toolbarClick={toolbarClick}
          toolbar={[
            "Search", "ColumnChooser",
            { text: "Excel", id: "grid_excelexport", prefixIcon: "e-excelexport" },
            { text: "PDF",   id: "grid_pdfexport",   prefixIcon: "e-pdfexport"   },
            { text: "CSV",   id: "grid_csvexport",   prefixIcon: "e-csvexport"   },
          ]}
          rowSelected={(args) => navigate(`/departments/${args.data.id}`)}
          cssClass="e-grid-custom"
        >
          <ColumnsDirective>
            <ColumnDirective
              field="name" headerText="Department" width="220" minWidth="160"
              template={(r) => <span className="font-medium text-gray-800">{r.name}</span>}
            />
            <ColumnDirective
              field="employee_count" headerText="Employees" width="120" minWidth="100" allowSorting
              template={(r) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                  {r.employee_count ?? 0}
                </span>
              )}
            />
            <ColumnDirective
              field="device_count" headerText="Devices" width="110" minWidth="90" allowSorting
              template={(r) => (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                  {r.device_count ?? 0}
                </span>
              )}
            />
            <ColumnDirective
              field="open_tickets" headerText="Open Tickets" width="120" minWidth="100" allowSorting
              template={(r) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                  ${(r.open_tickets ?? 0) > 0 ? "bg-orange-50 text-orange-600" : "bg-gray-50 text-gray-400"}`}>
                  {r.open_tickets ?? 0}
                </span>
              )}
            />
            <ColumnDirective
              field="notes" headerText="Notes" width="250" minWidth="150"
              template={(r) => <span className="text-xs text-gray-400 truncate">{r.notes ?? "—"}</span>}
            />
            <ColumnDirective
              field="created_at" headerText="Created" width="130" minWidth="110" allowSorting
              template={(r) => <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>}
            />
            <ColumnDirective
              headerText="Actions" width="100" allowSorting={false} allowFiltering={false}
              template={ActionsTemplate}
            />
          </ColumnsDirective>
          <Inject services={[Sort, Filter, Toolbar, ExcelExport, PdfExport, ColumnChooser, Page, Resize]} />
        </GridComponent>
      </div>

      {/* Modals */}
      <DepartmentForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        department={editTarget}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteMut.isPending}
        title="Delete Department"
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`
        }
        danger
      />
    </div>
  );
}