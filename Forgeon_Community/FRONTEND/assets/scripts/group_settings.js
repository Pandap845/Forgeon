(function () {
  var form = document.getElementById("groupSettingsForm");
  var nameInput = document.getElementById("groupName");
  var descInput = document.getElementById("groupDesc");
  var categorySelect = document.getElementById("category");
  var coverImage = document.getElementById("gsCoverImage");
  var iconImage = document.getElementById("gsIconImage");
  var coverInput = document.getElementById("coverInput");
  var iconInput = document.getElementById("iconInput");
  var removeIconBtn = document.querySelector(".gs-btn-remove");
  var archiveBtn = document.querySelector(".gs-btn-archive");
  var deleteBtn = document.querySelector(".gs-btn-delete");
  var pageTitle = document.getElementById("gsPageTitle");
  var metaInfo = document.getElementById("gsMetaInfo");
  var charCount = document.getElementById("charCount");
  var formMessage = document.getElementById("gsFormMessage");
  var inviteLink = document.getElementById("gsInviteLink");

  if (!form || !nameInput || !descInput || !categorySelect || !coverImage || !iconImage) return;

  var params = new URLSearchParams(window.location.search);
  var groupId = params.get("groupId");
  var currentGroup = null;

  function setMessage(message, isError) {
    if (!formMessage) return;
    formMessage.textContent = message || "";
    formMessage.style.color = isError ? "#ff9a9a" : "";
  }

  function updateCount() {
    if (!descInput || !charCount) return;
    var n = descInput.value.length;
    charCount.textContent = n + " character" + (n === 1 ? "" : "s");
  }

  function formatDate(value) {
    var d = new Date(value);
    if (Number.isNaN(d.getTime())) return "--";
    var day = String(d.getDate()).padStart(2, "0");
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var year = d.getFullYear();
    return day + "/" + month + "/" + year;
  }

  function isAbsoluteUrl(value) {
    return /^https?:\/\//i.test(value || "");
  }

  function resolveAssetUrl(value) {
    var url = String(value || "").trim();
    if (!url) return "";
    if (isAbsoluteUrl(url)) return url;
    if (url.startsWith("/")) return url;
    return "/" + url;
  }

  function populateCategoryOptions(categories, selectedId) {
    var list = Array.isArray(categories) ? categories : [];
    if (!list.length) {
      categorySelect.innerHTML = '<option value="" selected disabled>No categories available</option>';
      return;
    }

    categorySelect.innerHTML = list
      .map(function (category) {
        var id = category._id || category.id || "";
        var isSelected = String(id) === String(selectedId);
        return (
          '<option value="' +
          id +
          '"' +
          (isSelected ? " selected" : "") +
          ">" +
          String(category.name || "Unnamed category") +
          "</option>"
        );
      })
      .join("");
  }

  function renderGroup(group) {
    currentGroup = group;
    nameInput.value = group.name || "";
    descInput.value = group.description || "";

    var selectedCategoryId = group.category && (group.category._id || group.category.id || group.category);
    var currentOptions = Array.prototype.slice.call(categorySelect.options || []);
    var hasCategoryInSelect = currentOptions.some(function (opt) {
      return String(opt.value) === String(selectedCategoryId);
    });
    if (!hasCategoryInSelect && selectedCategoryId) {
      var option = document.createElement("option");
      option.value = selectedCategoryId;
      option.textContent = group.category && group.category.name ? group.category.name : "Current category";
      option.selected = true;
      categorySelect.appendChild(option);
    } else if (selectedCategoryId) {
      categorySelect.value = String(selectedCategoryId);
    }

    var coverUrl = resolveAssetUrl(group.coverImageUrl);
    var iconUrl = resolveAssetUrl(group.iconImageUrl);
    if (coverUrl) coverImage.src = coverUrl;
    if (iconUrl) iconImage.src = iconUrl;
    coverImage.alt = (group.name || "Group") + " cover image";
    iconImage.alt = (group.name || "Group") + " icon";

    if (pageTitle) {
      pageTitle.textContent = "Group Settings - " + (group.name || "Untitled");
    }
    if (metaInfo) {
      var creatorName = group.creator && group.creator.username ? group.creator.username : "Unknown";
      var categoryName = group.category && group.category.name ? group.category.name : "No category";
      var members = typeof group.memberCount === "number" ? group.memberCount : 0;
      var createdAt = formatDate(group.createdAt);
      metaInfo.textContent =
        "Created: " + createdAt + " | Creator: " + creatorName + " | Category: " + categoryName + " | Members: " + members;
    }

    if (inviteLink && groupId) {
      inviteLink.setAttribute(
        "href",
        "./group_invitations.html?groupId=" + encodeURIComponent(groupId)
      );
    }

    updateCount();
  }

  function applyPreview(inputEl, imageEl) {
    var file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    var objectUrl = URL.createObjectURL(file);
    imageEl.src = objectUrl;
  }

  async function loadGroup() {
    if (!groupId) {
      setMessage("Missing groupId in URL.", true);
      return;
    }

    try {
      var categories = await window.ForgeonCategoriesController.list();
      populateCategoryOptions(categories, null);
    } catch (_error) {
      populateCategoryOptions([], null);
    }

    try {
      var group = await window.ForgeonGroupsController.getById(groupId);
      renderGroup(group);
    } catch (error) {
      setMessage(error.message || "Could not load group details.", true);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (!groupId) {
      setMessage("Missing groupId in URL.", true);
      return;
    }

    var payload = {
      name: nameInput.value.trim(),
      description: descInput.value.trim(),
      category: categorySelect.value,
    };

    try {
      await window.ForgeonGroupsController.update(groupId, payload);
      setMessage("Changes saved.");
      await loadGroup();
    } catch (error) {
      setMessage(error.message || "Could not save changes.", true);
    }
  }

  async function onArchive() {
    if (!groupId) return;
    try {
      await window.ForgeonGroupsController.update(groupId, { isArchived: true });
      setMessage("Group archived.");
      await loadGroup();
    } catch (error) {
      setMessage(error.message || "Could not archive group.", true);
    }
  }

  async function onDelete() {
    if (!groupId) return;
    try {
      await window.ForgeonGroupsController.remove(groupId);
      window.location.href = "./group_management.html";
    } catch (error) {
      setMessage(error.message || "Could not delete group.", true);
    }
  }

  descInput.addEventListener("input", updateCount);
  form.addEventListener("submit", onSubmit);
  if (coverInput) coverInput.addEventListener("change", function () { applyPreview(coverInput, coverImage); });
  if (iconInput) iconInput.addEventListener("change", function () { applyPreview(iconInput, iconImage); });
  if (removeIconBtn) {
    removeIconBtn.addEventListener("click", function () {
      if (iconInput) iconInput.value = "";
      if (currentGroup) {
        var existingIcon = resolveAssetUrl(currentGroup.iconImageUrl);
        iconImage.src = existingIcon || iconImage.src;
      }
    });
  }
  if (archiveBtn) archiveBtn.addEventListener("click", onArchive);
  if (deleteBtn) deleteBtn.addEventListener("click", onDelete);

  loadGroup();
})();
