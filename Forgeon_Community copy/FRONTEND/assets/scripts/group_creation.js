(function () {
  var nameInput = document.getElementById("gcGroupName");
  var descInput = document.getElementById("gcGroupDesc");
  var categorySelect = document.getElementById("gcCategory");
  var coverInput = document.getElementById("gcCoverInput");
  var iconInput = document.getElementById("gcIconInput");
  var coverFileName = document.getElementById("gcCoverFileName");
  var iconFileName = document.getElementById("gcIconFileName");
  var countOut = document.getElementById("gcCharCount");
  var createBtn = document.getElementById("gcCreateBtn");
  var form = document.getElementById("groupCreationForm");
  var formMsg = document.getElementById("gcFormMsg");
  var categoryMsg = document.getElementById("gcCategoryMsg");
  var categoryForm = document.getElementById("gcCategoryForm");
  var newCategoryNameInput = document.getElementById("gcNewCategoryName");
  var newCategoryDescriptionInput = document.getElementById("gcNewCategoryDescription");
  var categoryFormMsg = document.getElementById("gcCategoryFormMsg");
  var createCategoryBtn = document.getElementById("gcCreateCategoryBtn");
  var inviteSection = document.getElementById("gcInviteSection");
  var inviteLink = document.getElementById("gcInviteLink");

  if (!form || !nameInput || !descInput || !categorySelect || !coverInput || !iconInput) return;

  var categoriesCache = [];
  var createdGroupId = "";

  function setMessage(el, message, isError) {
    if (!el) return;
    el.textContent = message || "";
    el.style.color = isError ? "#ff9a9a" : "";
  }

  function updateCharCount() {
    if (!descInput || !countOut) return;
    var count = descInput.value.length;
    countOut.textContent = count + " character" + (count === 1 ? "" : "s");
  }

  function getSelectedFileName(inputEl) {
    var file = inputEl && inputEl.files && inputEl.files[0];
    return file ? file.name : "No file selected";
  }

  function updateFileLabels() {
    if (coverFileName) coverFileName.textContent = getSelectedFileName(coverInput);
    if (iconFileName) iconFileName.textContent = getSelectedFileName(iconInput);
  }

  function updateSubmitState() {
    if (!createBtn) return;
    var canSubmit =
      nameInput.value.trim().length > 0 &&
      descInput.value.trim().length > 0 &&
      categorySelect.value &&
      coverInput.files &&
      coverInput.files.length > 0 &&
      iconInput.files &&
      iconInput.files.length > 0;
    createBtn.disabled = !canSubmit;
  }

  function syncFormState() {
    updateCharCount();
    updateFileLabels();
    updateSubmitState();
  }

  function normalizeCategoryName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function renderCategories(categories, selectedId) {
    categoriesCache = Array.isArray(categories) ? categories.slice() : [];

    if (!categoriesCache.length) {
      categorySelect.innerHTML = '<option value="" selected disabled>No categories available</option>';
      setMessage(categoryMsg, "No categories found. Create one first.", true);
      updateSubmitState();
      return;
    }

    categorySelect.innerHTML = categoriesCache
      .map(function (cat, index) {
        var id = cat._id || cat.id || "";
        var selected = selectedId
          ? String(id) === String(selectedId)
          : index === 0;
        return (
          '<option value="' +
          id +
          '"' +
          (selected ? " selected" : "") +
          ">" +
          String(cat.name || "Unnamed category") +
          "</option>"
        );
      })
      .join("");

    setMessage(categoryMsg, "");
    updateSubmitState();
  }

  async function loadCategories(selectedId) {
    try {
      var categories = await window.ForgeonCategoriesController.list();
      renderCategories(categories, selectedId);
    } catch (error) {
      categorySelect.innerHTML = '<option value="" selected disabled>Could not load categories</option>';
      setMessage(categoryMsg, error.message || "Could not load categories.", true);
      updateSubmitState();
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    setMessage(categoryFormMsg, "");

    var name = String(newCategoryNameInput.value || "").trim();
    var description = String(newCategoryDescriptionInput.value || "").trim();
    if (!name) {
      setMessage(categoryFormMsg, "Category name is required.", true);
      return;
    }

    var normalizedName = normalizeCategoryName(name);
    var duplicateExists = categoriesCache.some(function (cat) {
      return normalizeCategoryName(cat.name) === normalizedName;
    });
    if (duplicateExists) {
      setMessage(categoryFormMsg, "A category with that name already exists.", true);
      return;
    }

    try {
      createCategoryBtn.disabled = true;
      var created = await window.ForgeonCategoriesController.create({
        name: name,
        description: description,
      });

      await loadCategories(created._id || created.id);
      setMessage(categoryFormMsg, "Category created successfully.");
      newCategoryNameInput.value = "";
      newCategoryDescriptionInput.value = "";
    } catch (error) {
      setMessage(categoryFormMsg, error.message || "Could not create category.", true);
    } finally {
      createCategoryBtn.disabled = false;
    }
  }

  async function handleCreateGroup(event) {
    event.preventDefault();
    setMessage(formMsg, "");
    syncFormState();
    if (createBtn.disabled) return;

    var formData = new FormData();
    formData.append("name", nameInput.value.trim());
    formData.append("description", descInput.value.trim());
    formData.append("category", categorySelect.value);
    formData.append("coverImage", coverInput.files[0]);
    formData.append("iconImage", iconInput.files[0]);

    try {
      createBtn.disabled = true;
      createBtn.textContent = "Creating...";
      var group = await window.ForgeonGroupsController.create(formData);
      createdGroupId = String((group && (group._id || group.id)) || "");
      setMessage(formMsg, "Group created successfully. You can now invite members.");

      if (inviteSection && createdGroupId) {
        inviteSection.hidden = false;
      }
      if (inviteLink && createdGroupId) {
        inviteLink.setAttribute(
          "href",
          "./group_invitations.html?groupId=" + encodeURIComponent(createdGroupId)
        );
      }

      createBtn.textContent = "Group Created";
    } catch (error) {
      setMessage(formMsg, error.message || "Could not create group.", true);
      updateSubmitState();
      createBtn.textContent = "Create Group";
    }
  }

  nameInput.addEventListener("input", syncFormState);
  descInput.addEventListener("input", syncFormState);
  categorySelect.addEventListener("change", updateSubmitState);
  coverInput.addEventListener("change", syncFormState);
  iconInput.addEventListener("change", syncFormState);
  form.addEventListener("submit", handleCreateGroup);
  if (categoryForm) categoryForm.addEventListener("submit", handleCreateCategory);

  syncFormState();
  loadCategories();
})();
