nav = ["myDIV","myDIV2","myDIV3","myDIV4","myDIV5","myDIV6"]
myDIV.style.display = "none"
myDIV2.style.display = "none"
myDIV3.style.display = "none"
myDIV4.style.display = "none"
myDIV5.style.display = "none"
myDIV6.style.display = "none"

function showHide(s) {
	
	sI = String(nav[Number(s)])
	var currentBlock = document.getElementById(sI);
	if (currentBlock.style.display === "none") {
		currentBlock.style.display = "block";
	} else {
		currentBlock.style.display = "none";
	}
} 