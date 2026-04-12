import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FileDropzone } from "./file-dropzone";

describe("FileDropzone", () => {
  it("renders label text", () => {
    const onFilesSelected = vi.fn();

    render(
      <FileDropzone
        accept=".xlsx"
        multiple={true}
        maxFiles={5}
        onFilesSelected={onFilesSelected}
        label="Przeciągnij pliki tutaj"
      />,
    );

    expect(screen.getByText("Przeciągnij pliki tutaj")).toBeDefined();
  });

  it("calls onFilesSelected when files are dropped via input", () => {
    const onFilesSelected = vi.fn();

    render(
      <FileDropzone
        accept=".xlsx"
        multiple={true}
        maxFiles={5}
        onFilesSelected={onFilesSelected}
        label="Upuść pliki"
      />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = new File(["content"], "test.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it("limits files to maxFiles count", () => {
    const onFilesSelected = vi.fn();

    render(
      <FileDropzone
        accept=".xlsx"
        multiple={true}
        maxFiles={2}
        onFilesSelected={onFilesSelected}
        label="Max 2 pliki"
      />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const files = [
      new File(["a"], "a.xlsx"),
      new File(["b"], "b.xlsx"),
      new File(["c"], "c.xlsx"),
    ];

    fireEvent.change(input, { target: { files } });

    expect(onFilesSelected).toHaveBeenCalledTimes(1);
    const selectedFiles = onFilesSelected.mock.calls[0][0] as File[];
    expect(selectedFiles).toHaveLength(2);
  });

  it("shows selected file names and allows removal", () => {
    const onFilesSelected = vi.fn();

    render(
      <FileDropzone
        accept=".xlsx"
        multiple={true}
        maxFiles={5}
        onFilesSelected={onFilesSelected}
        label="Pliki"
      />,
    );

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    const file = new File(["content"], "raport.xlsx");
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText("raport.xlsx")).toBeDefined();

    const removeButton = screen.getByText("Usuń");
    fireEvent.click(removeButton);

    // After removal, onFilesSelected called with empty array
    expect(onFilesSelected).toHaveBeenLastCalledWith([]);
  });
});
