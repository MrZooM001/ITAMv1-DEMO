import { useState, useRef } from "react";
import Modal from "../../../components/ui/Modal";
import { useImportSpeccy, useDeviceHardware } from "../hooks/useDevices";
import { MdUploadFile, MdCheckCircle, MdError, MdFolderOpen, MdShield } from "react-icons/md";

// ── Helpers ────────────────────────────────────────────────
async function isSpeccyXml(file) {
    const text = await file.text().catch(() => "");
    return text.includes("<speccydata");
}

// Extract Ethernet MAC from Speccy XML text
function extractMac(xmlText) {
    // <entry title="MAC Address" value="XX:XX:XX:XX:XX:XX" />
    const match = xmlText.match(/title="MAC Address"\s+value="([^"]+)"/i);
    return match ? match[1].toLowerCase().trim() : null;
}

// ── File row ───────────────────────────────────────────────
function FileRow({ name, status, error }) {
    return (
        <div className="flex items-center gap-2 py-1.5 text-sm">
            {status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />}
            {status === "loading" && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />}
            {status === "success" && <MdCheckCircle className="text-green-500 text-base shrink-0" />}
            {status === "error" && <MdError className="text-red-400 text-base shrink-0" />}
            {status === "mac_mismatch" && <MdShield className="text-amber-500 text-base shrink-0" />}
            <span className={`flex-1 truncate ${status === "error" || status === "mac_mismatch" ? "text-red-500" : "text-gray-700"}`}>{name}</span>
            {error && (
                <span className="text-xs text-red-400 shrink-0 max-w-[160px] truncate" title={error}>
                    {error}
                </span>
            )}
        </div>
    );
}

// ── Main Component ─────────────────────────────────────────
// Props:
//   deviceId  — required
//   isUpdate  — true when opened from DeviceDetail (validates MAC)
export default function SpeccyUpload({ open, onClose, deviceId, isUpdate = false }) {
    const importMut = useImportSpeccy(deviceId);
    const { data: existingHw } = useDeviceHardware(deviceId);

    const fileInputRef = useRef(null);
    const folderInputRef = useRef(null);

    const [queue, setQueue] = useState([]);
    const [running, setRunning] = useState(false);
    const [done, setDone] = useState(false);

    function resetState() {
        setQueue([]);
        setRunning(false);
        setDone(false);
    }

    async function addFiles(fileList) {
        const files = Array.from(fileList).filter((f) => f.name.endsWith(".xml"));
        if (!files.length) return;

        const validated = await Promise.all(
            files.map(async (f) => {
                const text = await f.text().catch(() => "");
                const valid = text.includes("<speccydata");
                if (!valid) return { file: f, status: "error", error: "Not a Speccy XML file", xmlText: null };

                // MAC validation — only in update mode and if device already has a MAC
                if (isUpdate && existingHw?.eth_mac) {
                    const fileMac = extractMac(text);
                    const deviceMac = existingHw.eth_mac.toLowerCase().trim();
                    if (fileMac && fileMac !== deviceMac) {
                        return {
                            file: f,
                            status: "mac_mismatch",
                            error: `MAC mismatch: file has ${fileMac}, device has ${deviceMac}`,
                            xmlText: text,
                        };
                    }
                }

                return { file: f, status: "pending", error: null, xmlText: text };
            }),
        );
        setQueue((q) => [...q, ...validated]);
    }

    async function runUpload() {
        setRunning(true);
        const updated = [...queue];

        for (let i = 0; i < updated.length; i++) {
            if (updated[i].status === "error" || updated[i].status === "mac_mismatch") continue;

            updated[i] = { ...updated[i], status: "loading" };
            setQueue([...updated]);

            try {
                await importMut.mutateAsync(updated[i].file);
                updated[i] = { ...updated[i], status: "success" };
            } catch (err) {
                updated[i] = { ...updated[i], status: "error", error: err.message };
            }
            setQueue([...updated]);
        }

        setRunning(false);
        setDone(true);
    }

    const successCount = queue.filter((f) => f.status === "success").length;
    const errorCount = queue.filter((f) => f.status === "error" || f.status === "mac_mismatch").length;
    const pendingCount = queue.filter((f) => f.status === "pending").length;

    return (
        <Modal
            open={open}
            onClose={() => {
                resetState();
                onClose();
            }}
            title={isUpdate ? "Update Hardware (Speccy XML)" : "Import Speccy XML"}
            size="md"
        >
            <div className="space-y-4">
                {/* MAC notice in update mode */}
                {isUpdate && existingHw?.eth_mac && (
                    <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
                        <MdShield className="text-blue-500 text-base shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-semibold text-blue-700">MAC Address Validation Active</p>
                            <p className="text-xs text-blue-600 mt-0.5 font-mono">{existingHw.eth_mac}</p>
                            <p className="text-xs text-blue-500 mt-0.5">Only files with a matching Ethernet MAC address will be accepted.</p>
                        </div>
                    </div>
                )}

                {/* Drop zone + buttons */}
                {!done && (
                    <>
                        <div
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                                e.preventDefault();
                                addFiles(e.dataTransfer.files);
                            }}
                            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center
                hover:border-blue-300 hover:bg-blue-50/30 transition-colors cursor-default"
                        >
                            <MdUploadFile className="text-4xl text-gray-300 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Drag & drop Speccy XML files here</p>
                            <p className="text-xs text-gray-400 mt-1">or choose files / folder below</p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border border-gray-200
                  rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                            >
                                <MdUploadFile className="text-base" /> Files
                            </button>
                            <button
                                onClick={() => folderInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm border border-gray-200
                  rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                            >
                                <MdFolderOpen className="text-base" /> Folder
                            </button>
                        </div>

                        <input ref={fileInputRef} type="file" accept=".xml" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                        <input ref={folderInputRef} type="file" className="hidden" webkitdirectory="true" multiple onChange={(e) => addFiles(e.target.files)} />
                    </>
                )}

                {/* Queue */}
                {queue.length > 0 && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500 font-medium">
                                {queue.length} file{queue.length > 1 ? "s" : ""} selected
                                {errorCount > 0 && ` · ${errorCount} rejected`}
                            </span>
                            {!running && !done && (
                                <button onClick={resetState} className="text-xs text-red-400 hover:text-red-600">
                                    Clear all
                                </button>
                            )}
                        </div>
                        <div className="px-4 max-h-52 overflow-y-auto divide-y divide-gray-50">
                            {queue.map((item, i) => (
                                <FileRow key={i} name={item.file.name} status={item.status} error={item.error} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Result */}
                {done && (
                    <div
                        className={`px-4 py-3 rounded-xl text-sm font-medium
            ${errorCount === 0 ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}
                    >
                        {successCount > 0 && `✓ ${successCount} imported successfully. `}
                        {errorCount > 0 && `✗ ${errorCount} rejected (Speccy invalid or MAC mismatch).`}
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={() => {
                            resetState();
                            onClose();
                        }}
                        className="flex-1 py-2.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        {done ? "Close" : "Cancel"}
                    </button>
                    {!done && pendingCount > 0 && (
                        <button
                            onClick={runUpload}
                            disabled={running}
                            className="flex-1 py-2.5 text-sm font-medium bg-blue-600 hover:bg-blue-700
                disabled:bg-blue-400 text-white rounded-lg transition-colors"
                        >
                            {running ? `Uploading... (${successCount + errorCount}/${queue.length})` : `Upload ${pendingCount} file${pendingCount > 1 ? "s" : ""}`}
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
