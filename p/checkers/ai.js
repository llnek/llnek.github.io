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

;(function(window){

  "use strict";

  window["io/czlab/checkers/AI"]=function(Mojo){
    const Nega= window["io/czlab/mcfud/algo/negamax"]();
    const {Game:_G,
           ute:_,is}=Mojo;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    /** @class */
    class CZ extends Nega.GameBoard{
      constructor(p1v,p2v){
        super();
        this.actors= [0, p1v, p2v];
        this.grid=[];
        this.depth=5;
      }
      getStateCopier(){
        return (s)=> JSON.parse(JSON.stringify(s))
      }
      syncState(seed, actor){
        this.actors[0] = actor;
        this.grid= JSON.parse(JSON.stringify(seed));
      }
      getNextMoves(snap){
        let out=[],
            moves = _G.calcNextMoves(snap.cur.team, snap.state)[1];
        _.doseq(moves, (v)=>{
          out.push(v);
        });
        return out;
      }
      doMove(snap, move){
        let [r,c, target] =move;
        let [row,col,act]=target;
        let S=snap.state;
        let cur=S[r][c];
        let des=S[row][col];
        switch(act){
          case "J":
            S[row>r? row-1 : row+1][col>c? col-1 : col+1]=null;
            S[row][col]=cur;
            S[r][c]=null;
            cur.row=row;
            cur.col=col;
            break;
          case "S":
            S[row][col]=cur;
            S[r][c]=null;
            cur.row=row;
            cur.col=col;
            break;
        }
      }
      takeGFrame(){
        let ff = new Nega.GFrame();
        ff.state=JSON.parse(JSON.stringify(this.grid));
        ff.other= this.getOtherPlayer(this.actors[0]);
        ff.cur= this.actors[0];
        ff.lastBestMove=null;
        return ff;
      }
      isOver(snap){
        return _G.isWon(snap.state) || _G.isTie(snap.state) }
      //if we lose, return a negative value
      evalScore(snap){
        let s= _G.checkStatus(snap.state);
        let b=s[_G.TEAM_BLACK];
        let r=s[_G.TEAM_RED];
        let bt= b[0]+b[1];
        let rt= r[0]+r[1];
        if(snap.other.team==_G.TEAM_BLACK){
          if(rt==0 && bt>0) return -1000; // black won!
          if(b[1]>r[1]) return -500; // more black kings
          if(b[0]>r[0]) return -100; // more black pawns
        }else{
          if(bt==0 && rt>0) return 1000; // red won!
          if(r[1]>b[1]) return 500; // more red kings
          if(r[0]>b[0]) return 100; // more black pawns
        }
        return 0;
      }
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _G.AI=function(p1,p2){ return new CZ(p1,p2) };

  }

})(this);


