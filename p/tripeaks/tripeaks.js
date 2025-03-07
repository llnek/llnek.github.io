/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //A bit about the game...
  //The origin of this game came from a college school assignment.
  //The aim is to match 2 cards with values added up to 13, upon which
  //the cards will disappear.  You are also allowed to draw a card
  //from a pile, until it runs out.
  //For the special case of a King(K), matching 2 Kings will
  //earn you more points.
  //The game is won when you clear all the cards.

  const TILE_SHEET="images/tiles.json";

  ////////////////////////////////////////////////////////////////////////////
  /**/
  function scenes(Mojo){
    const {Scenes:_Z,
           Sprites:_S,
           Input:_I,
           Ute2D:_U,
           FX: _T,
           Game:_G,
           v2:_V,
           math:_M,
           ute:_,is}=Mojo;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    //set up some globals
    const
      UI_FONT=Mojo.DOKI_LOWER,
      C_TEXT=_S.color("#fff20f"),
      SplashCfg= {
        title:"TriPeaks",
        clickSnd:"click.mp3",
        action: {name:"PlayGame"}
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const CLICK_DELAY=343;
    const int=Math.floor;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    //load in game dependencies
    window["io/czlab/tripeaks/models"](Mojo);

    const doBackDrop=(s)=> s.insert(_S.fillMax("bg.jpg"));
    const playClick=()=> Mojo.sound("click.mp3").play();

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /* */
    ////////////////////////////////////////////////////////////////////////////
    _Z.scene("PlayGame",{
      flipDrawCard(){
        let dc=_G.model.getDrawCard();
        let c0, {width,height}=dc;
        _S.remove( _I.undoDrag(dc));
        c0=_G.model.discardDraw();
        if(c0){
          let [x,y]=_G.drawCardPos;
          _S.show(c0);
          _V.set(c0,x,y);
          _V.set(c0.g,x,y);
          _S.sizeXY( _I.makeDrag(c0), width,height);
          c0.m5.showFrame(1);
          _G.drawCard=this.insert(c0);
          Mojo.sound("pick.mp3").play();
        }
      },
      setup(){
        const
          self=this,
          K=Mojo.getScaleFactor();
        _.inject(this.g,{
          initLevel(){
            const m= _G.model= new _G.TriPeak(self);
            const rows= m.getNumRows();
            _G.gameOver=false;
            _G.peaks=0;
            _G.score=0;
            m.startGame(m.getDeck());
            for(let w,i=0; i<rows; ++i){
              w=m.getRowWidth(i);
              for(let c,j=0; j<w; ++j){
                c= _G.model.getCardAt(i,j);
                c && _S.remove(c);
              }
            }
            return this;
          },
          jiggleDC(pile){
            let x= _M.ndiv((_G.drawCard.x+_G.drawCard.width - pile.x)-_G.drawCard.width,2);
            x+=pile.x;
            _G.drawCardPos[0]=x;
            _G.drawCard.g.x=x;
            _V.setX(_G.drawCard,x);
            self.futureX(()=> {_G.checkEnd=true}, 3);
          },
          initHud(s){
            s=this.scoreText= _S.bmpText("Score: 0", UI_FONT, 64*K);
            return self.insert(_S.tint(s,C_TEXT));
          },
          drawDrawer(){
            let top= _G.pyramidBottom + _G.iconSize[1],
              c0= _G.model.getDrawCard(),
              len=2,gap=10*K,
              width= len * _G.iconSize[0] + (len-1)*gap,
              left=_M.ndiv(Mojo.width-width,2),
              pile= _S.spriteFrom(Mojo.ssf(TILE_SHEET,"cardJoker.png"),
                                  Mojo.ssf(TILE_SHEET,`${Mojo.u.stockPile}.png`));
            _V.set(_I.mkBtn(pile),left,top);
            _S.scaleXY(pile,K,K);
            pile.m5.press=()=>{
              if(_G.model.getDrawCard()) self.flipDrawCard();
              if(pile.visible && _G.model.isPileEmpty()){
                _S.hide(pile);
                this.jiggleDC( _I.undoBtn(pile));
              }
            };
            pile.m5.showFrame(1);
            _G.stockPile= self.insert(pile);
            left += gap + _G.iconSize[0];
            _V.set(c0,left,top);
            _V.copy(c0.g,c0);
            _S.show(c0);
            c0.m5.showFrame(1);
            _G.drawCardPos=[left,top];
            _G.drawCard= self.insert(_I.makeDrag(c0));
          },
          tweenAndShow(cards){
            (function slide(i){
              let cs=cards[i];
              cs.forEach(c=>{
                let x=c.g.x;
                let y=c.g.y;
                let t=_T.slide(c, _T.BOUNCE_OUT, x, y);
                t.onComplete=()=>{ c.x=x; c.y=y; }
              });
              Mojo.sound("open.mp3").play();
              if(i+1<cards.length)
                _.delay(100, ()=> slide(i+1));
            })(0)
          },
          drawArena(){
            let rows= _G.model.getNumRows(),
              lastRow= _G.model.getRowWidth(rows-1),
              sw=_G.iconSize[0],
              offsetv= _G.iconSize[1]*0.3*K,
              gap=0,tweens=[],
              maxWidth= lastRow*sw + (lastRow-1)*gap,
              left=_M.ndiv(Mojo.width-maxWidth,2),
              top= _G.iconSize[1],
              stackBottom= top,
              offsetX=left+maxWidth;
            for(let pc,rc,width,rowWidth,i=0; i<rows; ++i){
              width=_G.model.getRowWidth(i);
              rowWidth= width*sw + (width-1)*gap;
              pc = _M.ndiv(maxWidth-rowWidth,2);
              rc=[];
              for(let c,e,j=0; j<width; ++j){
                c=_G.model.getCardAt(i,j);
                e=_G.model.isCardExposed(i,j);
                if(c){
                  c.m5.showFrame(e?1:0);
                  if(e)
                    _I.makeDrag(c);
                  _V.set(c,left+pc,top);
                  //save the position
                  _V.set(c.g,c.x,c.y);
                  c.x -= offsetX;
                  rc.push(c);
                  self.insert(c);
                  stackBottom = c.y+c.height;
                }
                pc += _G.iconSize[0];
              }
              tweens.push(rc);
              top += (_G.iconSize[1] - offsetv);
            }
            _G.pyramidBottom= stackBottom;
            this.drawDrawer();
            this.tweenAndShow(tweens);
            return this;
          }
        })
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        doBackDrop(this) && this.g.initLevel() && this.g.initHud() && this.g.drawArena();
        Mojo.on(["flip.draw",this],"onFlipDraw",this);
        //Mojo.Input.setMultiTouch(false);
        _Z.run("AudioIcon",{
          xOffset: -10*K, yOffset:0
        });
      },
      onFlipDraw(){
        this.flipDrawCard();
      },
      postUpdate(){
        if(!_G.gameOver) this.checkEnd();
      },
      checkEnd(){
        let
          msg,
          K= Mojo.getScaleFactor();
        this.g.scoreText.text= `Score: ${_G.score}`;
        if(_G.model.isPeakEmpty()){
          msg="You Win!";
        }else if(_G.checkEnd){
          if(_G.model.isGameStuck()){
            msg="You Lose!";
          }
        }
        if(msg){
          _G.gameOver=true;
          _.delay(CLICK_DELAY, ()=> _Z.modal("EndGame", {
            replay:{name:"PlayGame"},
            quit:{name:"Splash", cfg:SplashCfg},
            msg,
            winner:msg.includes("Win")
          }));
        }
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles:["open.mp3","error.mp3",
                "slide.mp3","pick.mp3",
                "click.mp3",
                "game_over.mp3","game_win.mp3", "bg.jpg",TILE_SHEET],
    //24x140, 10x190
    arena:{width:3360, height:1900},
    stockPile:"cardBack_red5",
    scaleToWindow:"max",
    scaleFit:"y",
    start(...args){ scenes(...args) }
  });

})(this);





