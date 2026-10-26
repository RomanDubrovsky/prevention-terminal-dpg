/** Product name in registry copy — IDA for commercial centers, Prevention for school/platform. */
export function registryProductName(commercial: boolean): string {
  return commercial ? "IDA" : "Prevention";
}

export function applyRegistryBrand(text: string, commercial: boolean): string {
  if (!commercial) return text;
  return text
    .replace(/Prevention/g, "IDA")
    .replace(/школы или центра/g, "центра")
    .replace(/школы/g, "центра")
    .replace(/директора или зама/g, "руководителя центра")
    .replace(/директору и одному заместителю/g, "руководителю центра и ответственному сотруднику");
}
