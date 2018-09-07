/*
 * Camera Buttons
 */
const CameraButtons = function (blueprint3d) {

    const three = blueprint3d.three;
    const orbitControls = three.controls;

    const panSpeed = 50;
    const directions = {
        UP: 1,
        DOWN: 2,
        LEFT: 3,
        RIGHT: 4,
    };

    function init() {
        // Camera controls
        $("#reset-view").click(three.centerCamera);

        $("#zoom-in").click(zoomIn).dblclick(preventDefault);
        $("#zoom-out").click(zoomOut).dblclick(preventDefault);

        $("#move-up").click(directions.UP, pan).dblclick(preventDefault);
        $("#move-down").click(directions.DOWN, pan).dblclick(preventDefault);
        $("#move-left").click(directions.LEFT, pan).dblclick(preventDefault);
        $("#move-right").click(directions.RIGHT, pan).dblclick(preventDefault);
    }

    function preventDefault(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function pan(event) {
        const direction = event.data;
        switch (direction) {
            case directions.UP:
                orbitControls.panXY(0, panSpeed);
                break;
            case directions.DOWN:
                orbitControls.panXY(0, -panSpeed);
                break;
            case directions.LEFT:
                orbitControls.panXY(panSpeed, 0);
                break;
            case directions.RIGHT:
                orbitControls.panXY(-panSpeed, 0);
                break;
        }
    }

    function zoomIn(e) {
        orbitControls.dollyIn(1.1);
        orbitControls.update();
        preventDefault(e);
    }

    function zoomOut(e) {
        orbitControls.dollyOut(1.1);
        orbitControls.update();
        preventDefault(e);
    }

    init();
};


/*
 * Context menu for selected item
 */
const ContextMenu = function (blueprint3d) {

    let selectedItem = null;
    const three = blueprint3d.three;

    function init() {
        three.itemSelectedCallbacks.add(itemSelected);
        three.itemUnselectedCallbacks.add(itemUnselected);

        $("#context-menu-delete").click(function () {
            selectedItem.remove();
        });
        $("#context-menu-fixed").click(function () {
            selectedItem.setFixed(this.checked);
        });

        $("#item-height").change(resize);
        $("#item-width").change(resize);
        $("#item-depth").change(resize);
    }

    function itemSelected(item) {
        selectedItem = item;

        $("#context-menu-name").text(item.metadata.itemName);
        $("#context-menu-fixed").prop('checked', item.fixed);

        $("#item-height").val(selectedItem.getHeight());
        $("#item-width").val(selectedItem.getWidth());
        $("#item-depth").val(selectedItem.getDepth());

        $("#context-menu").show();
    }

    function itemUnselected() {
        selectedItem = null;
        $("#context-menu").hide();
    }

    function resize() {
        selectedItem.resize(
            $("#item-height").val(),
            $("#item-width").val(),
            $("#item-depth").val()
        );
    }

    init();
};


/*
 * Loading modal for items
 */
const ModalEffects = function (blueprint3d) {

    let itemsLoading = 0;

    function update() {
        if (itemsLoading > 0) {
            $("#loading-modal").show();
        } else {
            $("#loading-modal").hide();
        }
    }

    function init() {
        blueprint3d.model.scene.itemLoadingCallbacks.add(function () {
            itemsLoading += 1;
            update();
        });

        blueprint3d.model.scene.itemLoadedCallbacks.add(function () {
            itemsLoading -= 1;
            update();
        });

        update();
    }

    init();
};


/*
 * Side menu
 */
const SideMenu = function (blueprint3d, floorplanControls) {

    const scope = this;
    const tabs = {
        "FLOORPLAN": $("#floorplan_tab"),
        "SHOP": $("#items_tab"),
        "DESIGN": $("#design_tab")
    };
    const ACTIVE_CLASS = "active";

    this.states = {
        "DEFAULT": {
            "div": $("#viewer"),
            "tab": tabs.DESIGN
        },
        "FLOORPLAN": {
            "div": $("#floorplanner"),
            "tab": tabs.FLOORPLAN
        },
        "SHOP": {
            "div": $("#add-items"),
            "tab": tabs.SHOP
        }
    };
    this.stateChangeCallbacks = $.Callbacks();

    let currentState = scope.states.FLOORPLAN;

    function init() {
        for (const tab in tabs) {
            const elem = tabs[tab];
            elem.click(elem, tabClicked);
        }

        $("#update-floorplan").click(function () {
            setCurrentState(scope.states.DEFAULT);
        });

        initItems();

        setCurrentState(scope.states.DEFAULT);
    }

    function tabClicked(event) {
        const tab = event.data;
        for (const key in scope.states) {
            if (scope.states.hasOwnProperty(key) && scope.states[key].tab === tab) {
                setCurrentState(scope.states[key]);
                return;
            }
        }
    }

    function setCurrentState(newState) {
        if (currentState === newState) {
            return;
        }

        // show and hide the right divs
        currentState.tab.removeClass(ACTIVE_CLASS);
        currentState.div.hide();
        newState.tab.addClass(ACTIVE_CLASS);
        newState.div.show();

        // custom actions
        if (newState === scope.states.FLOORPLAN) {
            floorplanControls.updateFloorplanView();
            floorplanControls.handleWindowResize();
        }

        if (currentState === scope.states.FLOORPLAN) {
            blueprint3d.model.floorplan.update();
        }

        if (newState === scope.states.DEFAULT) {
            blueprint3d.three.updateWindowSize();
        } else {
            blueprint3d.three.stopSpin();
            blueprint3d.three.getController().setSelectedObject(null);
        }

        // set new state
        currentState = newState;
        scope.stateChangeCallbacks.fire(newState);
    }

    function initItems() {
        $("#add-items").find(".add-item").mousedown(function () {
            const modelUrl = $(this).attr("model-url");
            const itemName = $(this).attr("model-name");
            const itemType = parseInt($(this).attr("model-type"));
            const metadata = {
                modelUrl: modelUrl,
                itemName: itemName,
                itemType: itemType,
                resizable: true,
            };

            blueprint3d.model.scene.addItem(itemType, modelUrl, metadata, undefined, undefined, undefined, undefined);
            setCurrentState(scope.states.DEFAULT);
        });
    }

    init();
};


/*
 * Change floor and wall textures
 */
const TextureSelector = function (blueprint3d, sideMenu) {

    const three = blueprint3d.three;
    const wallDiv = $("#wallTextures");
    const floorDiv = $("#floorTexturesDiv");
    let currentTarget = null;

    function init() {
        three.wallClicked.add(wallClicked);
        three.floorClicked.add(floorClicked);
        three.nothingClicked.add(reset);
        three.itemSelectedCallbacks.add(reset);
        sideMenu.stateChangeCallbacks.add(reset);
        initTextureSelectors();
    }

    function initTextureSelectors() {
        $(".texture-select-thumbnail").click(function (e) {
            const textureUrl = $(this).attr("texture-url");
            const textureStretch = ($(this).attr("texture-stretch") === "true");
            const textureScale = parseInt($(this).attr("texture-scale"));
            currentTarget.setTexture(textureUrl, textureStretch, textureScale);

            $(this).blur();
            e.preventDefault();
        });
    }

    function wallClicked(halfEdge) {
        if (currentTarget) {
            reset();
            wallDiv.delay(250);
        }
        wallDiv.slideDown();
        currentTarget = halfEdge;
    }

    function floorClicked(room) {
        if (currentTarget) {
            reset();
            floorDiv.delay(250);
        }
        floorDiv.slideDown();
        currentTarget = room;
    }

    function reset() {
        wallDiv.slideUp();
        floorDiv.slideUp();
        currentTarget = null;
    }

    init();
};


/*
 * Floorplanner controls
 */
const ViewerFloorplanner = function (blueprint3d) {

    // buttons
    const move = '#move';
    const remove = '#delete';
    const draw = '#draw';

    const canvasWrapper = '#floorplanner';

    const activeStyle = 'btn-primary disabled';

    this.floorplanner = blueprint3d.floorplanner;

    const scope = this;

    function init() {
        $(window).resize(scope.handleWindowResize);
        scope.handleWindowResize();

        // mode buttons
        scope.floorplanner.modeResetCallbacks.add(function (mode) {
            $(draw).removeClass(activeStyle);
            $(remove).removeClass(activeStyle);
            $(move).removeClass(activeStyle);
            if (mode === BP3D.Floorplanner.floorplannerModes.MOVE) {
                $(move).addClass(activeStyle);
            } else if (mode === BP3D.Floorplanner.floorplannerModes.DRAW) {
                $(draw).addClass(activeStyle);
            } else if (mode === BP3D.Floorplanner.floorplannerModes.DELETE) {
                $(remove).addClass(activeStyle);
            }

            if (mode === BP3D.Floorplanner.floorplannerModes.DRAW) {
                $("#draw-walls-hint").show();
                scope.handleWindowResize();
            } else {
                $("#draw-walls-hint").hide();
            }
        });

        $(move).click(function () {
            scope.floorplanner.setMode(BP3D.Floorplanner.floorplannerModes.MOVE);
        });

        $(draw).click(function () {
            scope.floorplanner.setMode(BP3D.Floorplanner.floorplannerModes.DRAW);
        });

        $(remove).click(function () {
            scope.floorplanner.setMode(BP3D.Floorplanner.floorplannerModes.DELETE);
        });
    }

    this.updateFloorplanView = function () {
        scope.floorplanner.reset();
    };

    this.handleWindowResize = function () {
        $(canvasWrapper).height(window.innerHeight - $(canvasWrapper).offset().top);
        scope.floorplanner.resizeView();
    };

    init();
};


/*
 * Main controls
 */
const MainControls = function (blueprint3d) {

    function newDesign() {
        blueprint3d.model.loadSerialized('{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":-255,"y":255},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":255,"y":255},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":255,"y":-255},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":-255,"y":-255}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}');
    }

    function loadDesign() {
        const files = $("#loadFile").get(0).files;
        const reader = new FileReader();
        reader.onload = function () {
            blueprint3d.model.loadSerialized(reader.result);
        };
        reader.readAsText(files[0]);
    }

    function saveDesign() {
        const data = blueprint3d.model.exportSerialized();
        const blob = new Blob([data], {type: 'text'});
        const a = window.document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'design.blueprint3d';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    function init() {
        $("#new").click(newDesign);
        $("#saveFile").click(saveDesign);
        $("#loadFile").change(loadDesign);
    }

    init();
};


/*
 * Initialize!
 */
$(document).ready(function () {

    // main setup
    const opts = {
        floorplannerElement: 'floorplanner-canvas',
        threeElement: '#viewer',
        threeCanvasElement: 'three-canvas',
        textureDir: "models/textures/",
        widget: false
    };
    const blueprint3d = new BP3D.Blueprint3d(opts);

    const viewerFloorplanner = new ViewerFloorplanner(blueprint3d);
    const modalEffects = new ModalEffects(blueprint3d);
    const sideMenu = new SideMenu(blueprint3d, viewerFloorplanner, modalEffects);
    const textureSelector = new TextureSelector(blueprint3d, sideMenu);
    const cameraButtons = new CameraButtons(blueprint3d);
    const contextMenu = new ContextMenu(blueprint3d);

    MainControls(blueprint3d);

    // This serialization format needs work
    // Load a simple rectangle room
    blueprint3d.model.loadSerialized('{"floorplan":{"corners":{"f90da5e3-9e0e-eba7-173d-eb0b071e838e":{"x":-255,"y":255},"da026c08-d76a-a944-8e7b-096b752da9ed":{"x":255,"y":255},"4e3d65cb-54c0-0681-28bf-bddcc7bdb571":{"x":255,"y":-255},"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2":{"x":-255,"y":-255}},"walls":[{"corner1":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","corner2":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"f90da5e3-9e0e-eba7-173d-eb0b071e838e","corner2":"da026c08-d76a-a944-8e7b-096b752da9ed","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"da026c08-d76a-a944-8e7b-096b752da9ed","corner2":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}},{"corner1":"4e3d65cb-54c0-0681-28bf-bddcc7bdb571","corner2":"71d4f128-ae80-3d58-9bd2-711c6ce6cdf2","frontTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0},"backTexture":{"url":"rooms/textures/wallmap.png","stretch":true,"scale":0}}],"wallTextures":[],"floorTextures":{},"newFloorTextures":{}},"items":[]}');
});
