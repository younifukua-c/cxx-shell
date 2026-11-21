import { mountDomShell } from "@cxx/app-shell/dom";
import "@cxx/ui/theme.css";
import "@cxx/ui/native.css";
import * as nativeControls from "@cxx/ui/dom";
const owner = document.querySelector<HTMLElement>("#app")!;
document.body.style.margin = "0";
owner.style.height = "100vh";
const page = (id: string, name: string) => {
  const sidebar = document.createElement("aside");
  sidebar.textContent = name;
  const main = document.createElement("main");
  const input = document.createElement("input");
  input.setAttribute("aria-label", name + "草稿");
  main.append(input);
  document.body.append(sidebar, main);
  return { id, name, sidebar, main, accessApplicationId: null };
};
const applications = [page("notes", "笔记"), page("tasks", "任务")];
const shell = mountDomShell(owner, {
  apps: applications,
  theme: "dark",
  onError: (error) => {
    throw error;
  },
});
Object.assign(window, { shell, nativeControls, applications });
