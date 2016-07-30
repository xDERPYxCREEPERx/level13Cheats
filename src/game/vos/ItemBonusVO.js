define(['ash'], function (Ash) {

    var ItemBonusVO = Ash.Class.extend({
        
        bonuses: {},
        
        constructor: function (bonuses) {
            this.bonuses = bonuses ? bonuses : {};
        },
        
        getTotal: function () {
            var total = 0;
            for (var key in this.bonuses) {
                total += this.bonuses[key];
            }
            return total;
        },

        getBonus: function (bonusType) {
            return this.bonuses[bonusType] ? this.bonuses[bonusType] : 0;
        },
        
    });

    return ItemBonusVO;
});