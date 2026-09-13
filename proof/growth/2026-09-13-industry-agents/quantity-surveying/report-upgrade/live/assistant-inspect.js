JSON.stringify([...document.querySelectorAll("button")].map(x=>({text:x.textContent,aria:x.getAttribute("aria-label"),title:x.title})).filter(x=>/assistant/i.test(JSON.stringify(x))))
