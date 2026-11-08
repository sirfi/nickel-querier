import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

const setSecret: unknown[][] = [];
vi.mock("../../lib/commands", () => ({
  testConnection: async () => true,
  deleteConnectionSecret: async () => {},
  setConnectionSecret: async (...a: unknown[]) => {
    setSecret.push(a);
  },
}));

import ConnectionManager from "../ConnectionManager";
import type { SavedConnection } from "../../lib/types";

beforeEach(() => {
  localStorage.clear();
  setSecret.length = 0;
});
afterEach(cleanup);

const existing: SavedConnection = {
  id: "c1", name: "Prod", host: "h", port: 18093, username: "u", password: "", tls: true, keychain: true,
};

describe("ConnectionManager", () => {
  it("saves a new connection with the password in the keychain and TLS options", async () => {
    const onChange = vi.fn();
    render(<ConnectionManager connections={[]} onClose={() => {}} onConnectionsChange={onChange} />);
    fireEvent.click(screen.getByText("+ Add Connection"));
    fireEvent.change(screen.getByPlaceholderText("e.g. Production, Staging…"), { target: { value: "Dev" } });
    fireEvent.click(screen.getByLabelText("TLS / HTTPS"));
    fireEvent.click(screen.getByLabelText("Verify TLS certificate"));
    fireEvent.change(screen.getByPlaceholderText("18091"), { target: { value: "9000" } });
    fireEvent.change(screen.getByPlaceholderText("••••••••"), { target: { value: "pw" } });
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const saved = onChange.mock.calls[0][0][0] as SavedConnection;
    expect(saved).toMatchObject({ name: "Dev", tls: true, verify_tls: false, mgmt_port: 9000, password: "", keychain: true });
    expect(setSecret).toEqual([[saved.id, "pw"]]);
    expect(JSON.stringify(localStorage)).not.toContain('"pw"');
  });

  it("keeps the keychain password when editing with a blank password", async () => {
    const onChange = vi.fn();
    render(<ConnectionManager connections={[existing]} onClose={() => {}} onConnectionsChange={onChange} />);
    fireEvent.click(screen.getByText("✎"));
    expect(screen.getByPlaceholderText("Stored in keychain — leave blank to keep")).toBeTruthy();
    fireEvent.click(screen.getByText("Save"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls[0][0][0]).toMatchObject({ id: "c1", keychain: true, password: "" });
    expect(setSecret).toHaveLength(0);
  });
});
