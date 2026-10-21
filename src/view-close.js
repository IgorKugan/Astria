'use strict';

// Closing a WebContents without waitForBeforeUnload skips the page's shutdown
// lifecycle. Let games notify their server and persist browser data first.
function closePage(contents) {
  if (contents.isDestroyed()) return Promise.resolve();
  const siteSession = contents.session;
  return new Promise((resolve, reject) => {
    let timer;
    const allowClose = event => event.preventDefault();
    const cleanup = () => {
      clearTimeout(timer);
      contents.removeListener('will-prevent-unload', allowClose);
      contents.removeListener('destroyed', finished);
    };
    const finished = () => {
      cleanup();
      resolve();
    };
    contents.once('destroyed', finished);
    // The user explicitly requested suspend/remove/exit. Run the lifecycle,
    // while preventing a website from vetoing that action indefinitely.
    contents.once('will-prevent-unload', allowClose);
    timer = setTimeout(() => {
      try { if (!contents.isDestroyed()) contents.close(); else finished(); }
      catch (error) { cleanup(); reject(error); }
    }, 5000);
    timer.unref?.();
    try { contents.close({ waitForBeforeUnload: true }); }
    catch (error) { cleanup(); reject(error); }
  }).then(async () => {
    siteSession?.flushStorageData();
    await siteSession?.cookies?.flushStore();
  });
}

module.exports = { closePage };
