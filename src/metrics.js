'use strict';

// Report renderer processes only; shared processes are labelled, never divided
// arbitrarily between accounts. De-duplicate same-process iframes within a page.
function pageMetrics(pages, processes) {
  const byPid = new Map(processes.map(process => [process.pid, process]));
  const owners = new Map();
  for (const page of pages) for (const pid of new Set(page.pids)) {
    owners.set(pid, (owners.get(pid) || 0) + 1);
  }
  return Object.fromEntries(pages.map(page => {
    let ramKB = 0, cpu = 0, shared = false, count = 0;
    for (const pid of new Set(page.pids)) {
      const process = byPid.get(pid);
      if (!process) continue;
      ramKB += Math.max(0, Number(process.memory?.workingSetSize) || 0);
      cpu += Math.max(0, Number(process.cpu?.percentCPUUsage) || 0);
      shared ||= owners.get(pid) > 1;
      count++;
    }
    return [page.id, { ram: Math.round(ramKB / 1024), cpu, shared, processes: count }];
  }));
}

module.exports = { pageMetrics };
