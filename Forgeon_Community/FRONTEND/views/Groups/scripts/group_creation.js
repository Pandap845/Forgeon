(function () {
  var nameInput = document.getElementById("gcGroupName");
  var descInput = document.getElementById("gcGroupDesc");
  var countOut = document.getElementById("gcCharCount");
  var createBtn = document.getElementById("gcCreateBtn");
  var form = document.getElementById("groupCreationForm");

  function updateCharCount() {
    if (!descInput || !countOut) return;
    var count = descInput.value.length;
    countOut.textContent = count + " character" + (count === 1 ? "" : "s");
  }

  function updateSubmitState() {
    if (!nameInput || !descInput || !createBtn) return;
    var canSubmit = nameInput.value.trim().length > 0 && descInput.value.trim().length > 0;
    createBtn.disabled = !canSubmit;
  }

  function syncFormState() {
    updateCharCount();
    updateSubmitState();
  }

  if (nameInput) nameInput.addEventListener("input", syncFormState);
  if (descInput) descInput.addEventListener("input", syncFormState);

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (createBtn && createBtn.disabled) return;
      window.location.href = "./group_detail.html";
    });
  }

  syncFormState();
})();
