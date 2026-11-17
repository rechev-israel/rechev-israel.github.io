"use client";
import { GraphicDesigner } from "./graphic-designer";
import { saveGraphicAction } from "@/server/actions/creative";

type Props = Omit<Parameters<typeof GraphicDesigner>[0], "onSave">;
export function GraphicDesignerWithSave(props: Props) {
  return <GraphicDesigner {...props} onSave={(input) => saveGraphicAction(input)} />;
}
