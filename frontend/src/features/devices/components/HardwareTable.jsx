import {
  MdMemory, MdDeveloperBoard, MdStorage, MdMonitor,
  MdWifi, MdCable, MdComputer, MdCalendarToday,
} from "react-icons/md";
import { TbCpu } from "react-icons/tb";

// ── Helpers ────────────────────────────────────────────────
function mb(val) {
  if (!val) return "—";
  if (val >= 1024) return `${(val / 1024).toFixed(0)} GB`;
  return `${val} MB`;
}
function mhz(val) { return val ? `${val} MHz` : "—"; }
function val(v)   { return v ?? "—"; }
function date(d)  {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Row ────────────────────────────────────────────────────
function Row({ label, value, mono }) {
  return (
    <tr className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
      <td className="py-2.5 px-4 text-xs text-gray-500 font-medium w-44 whitespace-nowrap">{label}</td>
      <td className={`py-2.5 px-4 text-sm text-gray-800 ${mono ? "font-mono" : ""}`}>
        {value ?? "—"}
      </td>
    </tr>
  );
}

// ── Section ────────────────────────────────────────────────
function Section({ icon: Icon, title, iconColor, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 ${iconColor} bg-opacity-5`}>
        <Icon className={`text-lg ${iconColor}`} />
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      </div>
      <table className="w-full">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function HardwareTable({ hw }) {
  if (!hw) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <MdComputer className="text-5xl text-gray-200 mb-3" />
      <p className="text-gray-500 font-medium">No hardware data yet</p>
      <p className="text-sm text-gray-400 mt-1">Import a Speccy XML file to populate hardware specs</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* CPU */}
      <Section icon={TbCpu} title="CPU" iconColor="text-blue-500">
        <Row label="Name"        value={val(hw.cpu_name)} />
        <Row label="Model"       value={val(hw.cpu_model)} />
        <Row label="Cores"       value={hw.cpu_cores ? `${hw.cpu_cores} cores` : "—"} />
        <Row label="Threads"     value={hw.cpu_threads ? `${hw.cpu_threads} threads` : "—"} />
        <Row label="Base speed"  value={mhz(hw.cpu_speed_mhz)} />
      </Section>

      {/* Motherboard */}
      <Section icon={MdDeveloperBoard} title="Motherboard" iconColor="text-purple-500">
        <Row label="Manufacturer" value={val(hw.mb_manufacturer)} />
        <Row label="Model"        value={val(hw.mb_model)} />
        <Row label="BIOS version" value={val(hw.mb_bios_version)} mono />
        <Row label="BIOS date"    value={date(hw.mb_bios_date)} />
      </Section>

      {/* RAM */}
      <Section icon={MdMemory} title="RAM" iconColor="text-green-500">
        <Row label="Total"       value={mb(hw.ram_total_mb)} />
        <Row label="Type"        value={val(hw.ram_type)} />
        <Row label="Speed"       value={mhz(hw.ram_speed_mhz)} />
        <Row label="Slots total" value={hw.ram_slots_total ?? "—"} />
        <Row label="Slots used"  value={hw.ram_slots_used  ?? "—"} />
        <Row label="Slots free"  value={hw.ram_slots_free  ?? "—"} />
        {/* RAM modules */}
        {hw.ram_modules?.map((m, i) => (
          <Row
            key={i}
            label={`Slot ${m.slot}`}
            value={[m.manufacturer, m.type, mb(m.size_mb), mhz(m.speed_mhz)].filter(Boolean).join(" · ")}
          />
        ))}
      </Section>

      {/* Storage */}
      <Section icon={MdStorage} title="Storage" iconColor="text-amber-500">
        {hw.storage?.length ? hw.storage.map((disk, i) => (
          <Row
            key={i}
            label={disk.type ?? "Disk"}
            value={[disk.model, mb(disk.capacity_mb), disk.interface, disk.smart_status ? `SMART: ${disk.smart_status}` : null]
              .filter(Boolean).join(" · ")}
          />
        )) : <Row label="Disks" value="—" />}
      </Section>

      {/* GPU */}
      <Section icon={MdComputer} title="GPU" iconColor="text-red-400">
        <Row label="Manufacturer" value={val(hw.gpu_manufacturer)} />
        <Row label="Model"        value={val(hw.gpu_model)} />
        <Row label="Memory"       value={mb(hw.gpu_memory)} />
      </Section>

      {/* Monitor */}
      <Section icon={MdMonitor} title="Monitor" iconColor="text-teal-500">
        {hw.monitors?.length ? hw.monitors.map((m, i) => (
          <>
            <Row key={`${i}-mfr`} label={`Monitor ${i + 1} — Maker`}      value={val(m.manufacturer)} />
            <Row key={`${i}-mod`} label={`Monitor ${i + 1} — Model`}      value={val(m.model)} />
            <Row key={`${i}-res`} label={`Monitor ${i + 1} — Resolution`} value={val(m.resolution)} />
            <Row key={`${i}-hz`}  label={`Monitor ${i + 1} — Refresh`}    value={m.refresh_hz ? `${m.refresh_hz} Hz` : "—"} />
          </>
        )) : <Row label="Monitor" value="—" />}
      </Section>

      {/* Ethernet */}
      <Section icon={MdCable} title="Ethernet" iconColor="text-indigo-500">
        <Row label="Adapter" value={val(hw.eth_adapter)} />
        <Row label="MAC"     value={val(hw.eth_mac)} mono />
        {hw.eth_connections?.map((c, i) => (
          <>
            <Row key={`eth-ip-${i}`}  label="IP Address" value={val(c.ip)} mono />
            <Row key={`eth-sub-${i}`} label="Subnet"     value={val(c.subnet)} mono />
            <Row key={`eth-gw-${i}`}  label="Gateway"    value={val(c.gateway)} mono />
            <Row key={`eth-dhcp-${i}`}label="DHCP"       value={c.dhcp ? "Enabled" : "Disabled"} />
          </>
        ))}
      </Section>

      {/* WiFi */}
      <Section icon={MdWifi} title="Wi-Fi" iconColor="text-sky-500">
        <Row label="Adapter" value={val(hw.wifi_adapter)} />
        <Row label="MAC"     value={val(hw.wifi_mac)} mono />
        {hw.wifi_connections?.map((c, i) => (
          <>
            <Row key={`wifi-ip-${i}`}  label="IP Address" value={val(c.ip)} mono />
            <Row key={`wifi-sub-${i}`} label="Subnet"     value={val(c.subnet)} mono />
            <Row key={`wifi-gw-${i}`}  label="Gateway"    value={val(c.gateway)} mono />
            <Row key={`wifi-dhcp-${i}`}label="DHCP"       value={c.dhcp ? "Enabled" : "Disabled"} />
          </>
        ))}
      </Section>

      {/* Scan info */}
      {hw.speccy_scan_date && (
        <div className="lg:col-span-2">
          <Section icon={MdCalendarToday} title="Scan Info" iconColor="text-gray-400">
            <Row label="Speccy scan date" value={date(hw.speccy_scan_date)} />
            <Row label="Last updated"     value={date(hw.updated_at)} />
          </Section>
        </div>
      )}

    </div>
  );
}