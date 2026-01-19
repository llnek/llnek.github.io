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
  window["io/czlab/tictactoe/AI"]=function(Mojo){

    const Algo= window["io/czlab/mcfud/algo/negamax"]();
    //const Algo= window["io/czlab/mcfud/algo/minimax"]();
    const {Game:_G,
           ute:_,is}=Mojo;

    ////////////////////////////////////////////////////////////////////////////
    /** @class */
    class CZ extends Algo.GameBoard{
      constructor(p1v,p2v){
        super();
        this.actors= [0, p1v, p2v];
        this.grid=[];
        this.depth=6;
        this.goals= _G.mapGoalSpace()
      }
      isNil(cellv){
        return cellv == 0
      }
      getFirstMove(){
        let sz= this.grid.length;
        if(sz>0 && _.every(this.grid,0)) return _.randInt2(0,sz-1)
      }
      syncState(seed, actor){
        this.grid.length=0;
        this.actors[0] = actor;
        _.append(this.grid,seed)
      }
      getNextMoves(snap){
        let rc= [],
            sz= snap.state.length;
        for(let i=0; i<sz; ++i)
          if(this.isNil(snap.state[i])) rc.push(i);
        return rc;
      }
      getStateCopier(){
        return s=> _.deepCopyArray(s)
      }
      undoMove(snap, move){
        _.assert(move>=0 &&
                 move<snap.state.length);
        snap.state[move] = 0;
      }
      doMove(snap, move){
        _.assert(move>=0 &&
                 move<snap.state.length);
        if(this.isNil(snap.state[move]))
          snap.state[move] = snap.cur;
        else
          throw `Error: cell [${move}] is not free`
      }
      takeGFrame(){
        let ff = new Algo.GFrame(_G.DIM);
        ff.state=_.fill(_G.DIM*_G.DIM,0);
        ff.other= this.getOtherPlayer(this.actors[0]);
        ff.cur= this.actors[0];
        _.copy(ff.state,this.grid);
        return ff;
      }
      evalScore(snap){
        let p2= this.getAlgoActor(),
          p1= this.getOtherPlayer(p2);
        //if we lose, return a negative value
        for(let g, i=0; i<this.goals.length; ++i){
          g= this.goals[i];
          if(this.testWin(snap.state, p1, g))
            return -100;
          if(this.testWin(snap.state, p2, g))
            return 100;
        }
        return 0;
      }
      isOver(snap,move){
        for(let g, i=0; i < this.goals.length; ++i){
          g= this.goals[i];
          if(this.testWin(snap.state, snap.other, g) ||
             this.testWin(snap.state, snap.cur, g)) {
            return true;
          }
        }
        return this.isStalemate(snap);
      }
      testWin(vs, actor, g){
        let cnt=g.length;
        for(let n= 0; n<g.length; ++n)
          if(actor == vs[g[n]])
            --cnt;
        return cnt == 0;
      }
      isStalemate(snap){
        return _.notAny(snap.state, 0) }
    }

    _G.TTToe=function(p1v,p2v){
      let c= new CZ(p1v,p2v);
      if(Algo.algo=="negamax"){
        c.evalScore=function(snap,move){
          for(let g, i=0; i<c.goals.length; ++i){
            g= c.goals[i];
            if(c.testWin(snap.state, snap.other, g)) return -100;
            if(c.testWin(snap.state, snap.cur, g)) return 100;
          }
          return 0;
        }
      }
      return c;
    }
  }

})(this);


