define([
    'ash',
    'game/constants/UIConstants',
    'game/WorldCreator',
    'game/constants/PlayerActionConstants',
    'game/nodes/PlayerLocationNode',
    'game/nodes/PlayerStatsNode',
    'game/nodes/sector/CampNode',
    'game/nodes/NearestCampNode',
    'game/components/sector/improvements/CampComponent',
    'game/components/common/PositionComponent',
], function (Ash,
    UIConstants,
	WorldCreator,
	PlayerActionConstants,
	PlayerLocationNode,
	PlayerStatsNode,
	CampNode,
	NearestCampNode,
	CampComponent,
	PositionComponent
) {
    var UIOutElementsSystem = Ash.System.extend({
	
        currentLocationNodes: null,
        campNodes: null,
        nearestCampNodes: null,
		playerStatsNodes: null,
        
        gameState: null,
        playerActions: null,
        uiFunctions: null,
        resourcesHelper: null,
        levelHelper: null,
        engine: null,
    
        constructor: function (gameState, playerActions, uiFunctions, resourcesHelper, levelHelper) {
            this.gameState = gameState;
            this.playerActions = playerActions;
            this.uiFunctions = uiFunctions;
            this.resourcesHelper = resourcesHelper;
            this.levelHelper = levelHelper;
            return this;
        },
    
        addToEngine: function (engine) {
            this.engine = engine;
            this.currentLocationNodes = engine.getNodeList(PlayerLocationNode);
            this.campNodes = engine.getNodeList(CampNode);
            this.nearestCampNodes = engine.getNodeList(NearestCampNode);
			this.playerStatsNodes = engine.getNodeList(PlayerStatsNode);
            
            this.campNodes.nodeAdded.add(this.onCampNodeAdded, this);
            this.campNodes.nodeRemoved.add(this.onCampNodeRemoved, this);
        },
    
        removeFromEngine: function (engine) {
            this.engine = null;
            this.currentLocationNodes = null;
            this.campNodes = null;
            this.nearestCampNodes = null;
        },
        
        onCampNodeAdded: function( node ) {
            this.updateTabVisibility();
        },
        
        onCampNodeRemoved: function( node ) {
            this.updateTabVisibility();
        },
    
        update: function (time) {
            this.updateButtons();
            this.updateProgressbars();
            this.updateTabVisibility();
            this.updateTabs();
            this.updateInfoCallouts();
        },
        
        updateButtons: function () {
            
            // TODO performance bottleneck
            
            var playerActions = this.playerActions;
            var uiFunctions = this.uiFunctions;
            var levelHelper = this.levelHelper;
			
            var playerVision = this.playerStatsNodes.head.vision.value;
            
            var hasButtonCooldown = function (button) {
                return ($(button).attr("data-hasCooldown") == "true");
            };
			
			var isButtonDisabledVision = function (button) {
                var action = $(button).attr("action");
				if (action) {
					var requirements = PlayerActionConstants.getReqs(action);
					if (requirements) return (playerVision < requirements.vision);
				}
				return false;
			};
            
            var isButtonDisabled = function (button) {
                if ($(button).hasClass("btn-meta")) return false;
                
                if ($(button).attr("data-type") === "minus") {
                    var input = $(button).siblings("input");
                    return parseInt(input.val()) <= parseInt(input.attr("min"));
                }
                
                if ($(button).attr("data-type") === "plus") {
                    var input = $(button).siblings("input");
                    return parseInt(input.val()) >= parseInt(input.attr("max"));
                }
            
                if (!($(button).hasClass("action"))) return false;	
                
                var action = $(button).attr("action");
                if (!action) return false;
                
                var sector = $(button).attr("sector");
                var sectorEntity = null;
                if (sector) {
                    var l = sector.split("-")[0];
                    var s = sector.split("-")[1];
                    sectorEntity = levelHelper.getSectorByPosition(l, s)
                }
                return playerActions.checkRequirements(action, false, sectorEntity).value < 1;
            };
            
            var isButtonDisabledResources = function (button) {
                var action = $(button).attr("action");
                return playerActions.checkCosts(action, false) < 1;
            };
            
            // Update disabled status
            $.each($("button"), function () {
				var disabledVision = isButtonDisabledVision($(this));
				var disabledBasic = !disabledVision && isButtonDisabled($(this));
				var disabledResources = !disabledVision && !disabledBasic && isButtonDisabledResources($(this));
				var disabledCooldown = !disabledVision && !disabledBasic && !disabledResources && hasButtonCooldown($(this));
				var isDisabled = disabledBasic || disabledVision || disabledResources || disabledCooldown;
				$(this).toggleClass("btn-disabled", isDisabled);
				$(this).toggleClass("btn-disabled-basic", disabledBasic);
				$(this).toggleClass("btn-disabled-vision", disabledVision);
				$(this).parent(".container-btn-action").toggleClass("btn-disabled-vision", disabledVision);
				$(this).toggleClass("btn-disabled-resources", disabledResources);
				$(this).toggleClass("btn-disabled-cooldown", disabledCooldown);
				$(this).attr("disabled", isDisabled);
            });
            
            // Update button callouts and cooldowns
            var showStorage = this.resourcesHelper.getCurrentStorageCap();
            $.each($("button.action"), function () {
                var isVisible = ($(this).is(":visible"));
                $(this).siblings(".cooldown-reqs").css("display", isVisible ? "block" : "none");
                $(this).parent(".container-btn-action").css("display", $(this).css("display"));
                var action = $(this).attr("action");
                if (!action) {
                    // console.log("WARN: Action button w unknown action: " + $(this).attr("id"));
                    // skip updating
                } else if(!isVisible) {
                    // skip updating
                } else {
                    var ordinal = playerActions.getOrdinal(action);
                    var costFactor = playerActions.getCostFactor(action);
                    var costs = PlayerActionConstants.getCosts(action, ordinal, costFactor);
                    var content = PlayerActionConstants.getDescription(action);
                    var hasCosts = action && costs && Object.keys(costs).length > 0;
                    var hasCostBlockers = false;
                    var isHardDisabled = isButtonDisabled($(this)) || isButtonDisabledVision($(this));
                    var isResDisabled = isButtonDisabledResources($(this));

                    // Update callout content
                    var bottleNeckCostFraction = 1;
                    var disabledReason = playerActions.checkRequirements(action, false).reason;
                    var isDisabledOnlyForCooldown = (!(disabledReason) && hasButtonCooldown($(this)));
                    if (!isHardDisabled || isDisabledOnlyForCooldown) {
                        if (hasCosts) {
                            if (content.length > 0) content += "<hr/>";
                            for (var key in costs) {
                                var name = uiFunctions.names.resources[key] ? uiFunctions.names.resources[key] : key;
                                var value = costs[key];
                                var classes = "action-cost";
                                var costFraction = playerActions.checkCost(action, key);
                                if (costFraction < 1) classes += " action-cost-blocker";
                                if (isResource(key.split("_")[1]) && value > showStorage) {
                                    classes += " action-cost-blocker-storage";
                                    hasCostBlockers = true;
                                }
                                else if (costFraction < bottleNeckCostFraction) bottleNeckCostFraction = costFraction;
                                content += "<span class='" + classes + "'>" + name + ": " + value + "</span><br/>";
                            }
                        }
                    } else {
                        if (content.length > 0) content += "<hr/>";
                        content += "<span class='btn-disabled-reason action-cost-blocker'>" + disabledReason + "</span>";
                    }
                    $(this).siblings(".btn-callout").children(".btn-callout-content").html(content);
                    $(this).parent().siblings(".btn-callout").children(".btn-callout-content").html(content);
                    
                
                    // Check requirements affecting req-cooldown
                    bottleNeckCostFraction = Math.min(bottleNeckCostFraction, playerActions.checkRequirements(action, false).value);
					if (hasCostBlockers) bottleNeckCostFraction = 0;
					if (isHardDisabled) bottleNeckCostFraction = 0;
                    
                    // Update cooldown overla
                    var hasReqsCooldown = ($(this).hasClass("btn-disabled-resources") && hasCosts && !hasCostBlockers);
                    $(this).siblings(".cooldown-reqs").css("width", ((bottleNeckCostFraction) * 100) + "%");
                    $(this).children(".cooldown-action").css("display", !isHardDisabled && !isResDisabled ? "inherit" : "none");
                }
            });
        },
        
        updateProgressbars: function () {
            $.each($(".progress-wrap"), function () {
                if ($(this).is(":visible") && !($(this).data("animated") === true)) {
                    $(this).data("animated", true);
                    var percent = ($(this).data('progress-percent') / 100);
                    var animationLength = $(this).data("animation-counter") > 0 ? ($(this).data('animation-length')) : 0;
                    var progressWrapWidth = $(this).width();
                    var progressWidth = percent * progressWrapWidth;
                    $(this).children(".progress-bar").stop().animate({ left: progressWidth}, animationLength, function() {
                    $(this).parent().data("animated", false);
                    $(this).parent().data("animation-counter", $(this).parent().data("animation-counter") + 1);
                    });
                } else {
                    $(this).data("animation-counter", 0);
                }
            });
        },
        
        updateTabVisibility: function() {
            var posHasCamp =
            this.currentLocationNodes.head != null &&
            this.currentLocationNodes.head.entity.has(CampComponent);
            var levelHasCamp = this.nearestCampNodes.head != null;
            $("#switch-tabs #switch-in").toggle(levelHasCamp);
            $("#switch-tabs #switch-upgrades").toggle(this.gameState.unlockedFeatures.upgrades);
            $("#switch-tabs #switch-world").toggle(this.gameState.numCamps > 1 && this.gameState.unlockedFeatures.trade == true);
            $("#switch-tabs #switch-bag").toggle(this.gameState.unlockedFeatures.bag);
            $("#switch-tabs #switch-out").toggle(true);
        },
        
        updateTabs: function() {
            var posHasCamp =
            this.currentLocationNodes.head != null &&
            this.currentLocationNodes.head.entity.has(CampComponent);
            var levelCamp = this.nearestCampNodes.head;
            var currentCamp = levelCamp ? levelCamp.entity : null;
            if (currentCamp) {
            var campComponent = currentCamp.get(CampComponent);
            $("#switch-tabs #switch-in").text(campComponent.getName());
            $("#switch-tabs #switch-in").toggleClass("disabled", !posHasCamp);
            }
        },
        
        updateInfoCallouts: function () {
            // TODO performance bottleeck
            $.each($(".callout-container"), function() {
            if ($(this).children(".info-callout-target").length > 0) {
                var visible = true;
                $.each($(this).children(".info-callout-target").children(), function() {
                    visible = visible && $(this).css("display") != "none";
                });
                $(this).toggle(visible);
            }
            });
        },
    });

    return UIOutElementsSystem;
});
