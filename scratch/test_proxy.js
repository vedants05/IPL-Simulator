async function testProxy() {
    try {
        const target = "https://www.espncricinfo.com/cricketers/josh-inglis-662973";
        const url = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
        const res = await fetch(url);
        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Length:", text.length);
        console.log("Preview:", text.substring(0, 500));
    } catch (e) {
        console.error(e);
    }
}
testProxy();
