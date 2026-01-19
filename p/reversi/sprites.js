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
  window["io/czlab/reversi/Sprites"]= function(Mojo){

    const _N=window["io/czlab/mcfud/algo/negamax"]();
    const int=Math.floor;
    const {Scenes:_Z,
           Sprites:_S,
           Input:_I,
           Game:_G,
           v2:_V,
           math:_M,
           ute:_,is} = Mojo;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _.inject(_G,{
      AI(scene,v){
        const self=this;
        const o={
          pnum:v,
          board: self.Reversi(self.X, self.O),
          aiMove(){ _.delay(500,()=> o.makeMove()) },
          makeMove(){
            let pos,rc;
            this.board.syncState(self.cells, this.pnum);
            pos= _N.evalNegaMax(this.board);
            if(pos)
              rc= self.checkState(pos);
            if(rc && rc.length>0){
              rc.forEach(c=>{
                self.flip(scene,c);
                self.cells[c[0]][c[1]]=v;
              });
              self.flip(scene,pos,v);
              self.cells[pos[0]][pos[1]]=v;
              _G.playSnd();
              self.switchPlayer();
            }else{
            }
          }
        };
        return (Mojo.on(["ai.move",o], "aiMove",o),o);
      },
      flip(s,pos,V){
        for(let v,p,c,i=0,z=s.children.length;i<z;++i){
          c=s.children[i];
          if(c && c.g.gpos){
            p=c.g.gpos;
            if(p[0]==pos[0] && p[1]==pos[1]){
              if(V===undefined){
                _.assert(c.m5.enabled===false);
                v= c.g.gval==this.X?this.O:this.X;
              }else{
                //_.assert(c.m5.enabled===true);
                v=V;
              }
              c.m5.showFrame(v);
              c.g.gval=v;
              c.m5.enabled=false;
              c.m5.marked=true;
              break;
            }
          }
        }
      },
      Tile(id,x,y,tileX,tileY,props){
        const self=this;
        let s= _S.sprite(_S.frames("icons.png",tileX,tileY));
        _S.scaleXY(s,self.iconScale[0],self.iconScale[1]);
        _V.set(_S.uuid(s,id),x,y);
        _.inject(s.g,props);
        _I.mkBtn(_S.centerAnchor(s));
        if(props.gval != 0){
          s.m5.enabled=false
        }
        s.m5.showFrame(self.getIcon(props.gval));
        s.g.aiMoved=function(){
          s.m5.enabled=false;
          s.m5.marked=true;
        };
        s.m5.press=function(){
          //if end or AI is thinking, back off
          //if cell already marked, go away
          if(self.gameOver ||
             (self.ai && self.pcur==self.ai.pnum) || s.m5.marked) {return}
          if(self.cells[s.g.gpos[0]]
                       [s.g.gpos[1]] != 0)
            throw "Fatal: cell marked already!!!!";
          let rc= self.checkState(s.g.gpos);
          if(rc.length>0){
            rc.forEach(c=>{
              self.flip(s.parent,c);
              self.cells[c[0]][c[1]]=self.pcur;
            });
            self.flip(s.parent,s.g.gpos,self.pcur);
            self.cells[s.g.gpos[0]][s.g.gpos[1]]= self.pcur;
            _G.playSnd();
            self.switchPlayer();
          }else{
          }
        }
        return (Mojo.on(["ai.moved",s],"aiMoved",s.g),s);
      }
    });
  }

})(this);

